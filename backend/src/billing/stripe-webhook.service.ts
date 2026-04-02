import { Injectable, Logger } from '@nestjs/common';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import type { MontiStripeClient } from './stripe.service';
import { StripeService } from './stripe.service';
import {
  type CheckoutSessionLike,
  type InvoiceLike,
  type StripeWebhookEventPayload,
  type SubscriptionLike,
} from './stripe-webhook.types';
import { stripeUnixSecondsToIso } from './stripe-time.util';

function stripeRefId(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && 'deleted' in value && (value as { deleted?: boolean }).deleted) {
    return null;
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function asSubscriptionLike(raw: unknown): SubscriptionLike {
  const o = raw as Record<string, unknown>;
  const items = o.items as { data?: Array<Record<string, unknown>> } | null | undefined;
  const firstItem = items?.data?.[0];
  return {
    id: String(o.id ?? ''),
    customer: o.customer,
    status: String(o.status ?? ''),
    metadata: (o.metadata ?? null) as Record<string, string | undefined> | null,
    current_period_start: (firstItem?.current_period_start ?? o.current_period_start ?? null) as number | null,
    current_period_end: (firstItem?.current_period_end ?? o.current_period_end ?? null) as number | null,
    cancel_at_period_end: o.cancel_at_period_end === true,
    cancel_at: (o.cancel_at != null ? Number(o.cancel_at) : null),
    items: items as SubscriptionLike['items'],
  };
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly config: BillingConfigService,
    private readonly billingRepository: BillingRepository,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * After signature verification. Idempotent on `stripe_event_id`; rethrows on handler failure so Stripe retries.
   */
  async processVerifiedEvent(event: StripeWebhookEventPayload): Promise<'processed' | 'duplicate'> {
    const payloadObject =
      typeof event.data?.object === 'object' && event.data.object !== null
        ? (event.data.object as Record<string, unknown>)
        : null;

    const inserted = await this.billingRepository.tryInsertWebhookEventReceived({
      stripeEventId: event.id,
      eventType: event.type,
      payload: payloadObject,
    });

    if (!inserted) {
      return 'duplicate';
    }

    await this.billingRepository.updateWebhookEventByStripeEventId(event.id, {
      processing_status: 'processing',
    });

    try {
      await this.dispatchHandlers(event);
      await this.billingRepository.updateWebhookEventByStripeEventId(event.id, {
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        error_message: null,
      });
      return 'processed';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.billingRepository.updateWebhookEventByStripeEventId(event.id, {
        processing_status: 'failed',
        error_message: message,
        processed_at: new Date().toISOString(),
      });
      throw err;
    }
  }

  private async dispatchHandlers(event: StripeWebhookEventPayload): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await this.handleCheckoutSessionEvent(event, this.stripeService.requireStripe());
        return;
      case 'invoice.paid':
        await this.handleInvoicePaid(event, this.stripeService.requireStripe());
        return;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event, this.stripeService.requireStripe());
        return;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionLifecycle(event);
        return;
      default:
        this.logger.debug(`Ignoring unhandled Stripe event type ${event.type}`);
    }
  }

  private async handleCheckoutSessionEvent(
    event: StripeWebhookEventPayload,
    stripe: MontiStripeClient,
  ): Promise<void> {
    const session = event.data.object as CheckoutSessionLike;
    const userId = session.client_reference_id ?? session.metadata?.monti_user_id ?? null;
    if (!userId) {
      this.logger.warn(`Checkout session ${session.id} missing client_reference_id / monti_user_id metadata`);
      return;
    }

    if (session.mode === 'subscription') {
      const subRef = session.subscription;
      const subId = typeof subRef === 'string' ? subRef : subRef?.id;
      if (!subId) {
        return;
      }
      const subRaw = await stripe.subscriptions.retrieve(subId);
      const sub = asSubscriptionLike(subRaw);
      await this.syncSubscriptionMirror(userId, sub);
      const customerId = stripeRefId(session.customer);
      if (customerId) {
        await this.billingRepository.upsertBillingCustomerStripeId(userId, customerId);
      }
      return;
    }

    if (session.mode === 'payment' && session.payment_status === 'paid') {
      const intent = session.metadata?.monti_checkout_intent;
      if (intent === 'topup') {
        await this.ensureTopupGrant(session, event.id);
      }
    }
  }

  private async handleInvoicePaid(event: StripeWebhookEventPayload, stripe: MontiStripeClient): Promise<void> {
    const invoice = event.data.object as InvoiceLike;
    // Stripe API 2025-01-27.acacia+ moved subscription off the invoice top-level into parent.subscription_details.subscription
    const subscriptionId =
      stripeRefId(invoice.subscription) ?? invoice.parent?.subscription_details?.subscription ?? null;
    if (!subscriptionId) {
      return;
    }

    if (invoice.amount_paid === 0) {
      return;
    }

    const customerId = stripeRefId(invoice.customer);
    if (!customerId) {
      return;
    }

    const subRaw = await stripe.subscriptions.retrieve(subscriptionId);
    const sub = asSubscriptionLike(subRaw);

    let userId = await this.billingRepository.findUserIdByStripeCustomerId(customerId);
    if (!userId) {
      const metaUserId = sub.metadata?.monti_user_id ?? null;
      if (!metaUserId) {
        this.logger.warn(
          `invoice.paid: no Monti user for Stripe customer ${customerId} (subscription ${subscriptionId})`,
        );
        return;
      }
      await this.billingRepository.upsertBillingCustomerStripeId(metaUserId, customerId);
      userId = metaUserId;
    }

    await this.syncSubscriptionMirror(userId, sub);

    const existing = await this.billingRepository.findCreditGrantByStripeInvoiceId(invoice.id);
    if (existing) {
      return;
    }

    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      this.config.launchPricingVersionKey,
    );
    if (!snapshot) {
      throw new Error(`Missing pricing_rule_snapshots row for ${this.config.launchPricingVersionKey}`);
    }

    const amount = this.config.launchCatalog.paidMonthlyCredits;
    // Use the subscription's service period (forward-looking) rather than the invoice's
    // lookback usage period, which lands both start and end on the same timestamp for
    // a newly created subscription.
    const periodStart = stripeUnixSecondsToIso(sub.current_period_start ?? null);
    const periodEnd = stripeUnixSecondsToIso(sub.current_period_end ?? null);

    await this.billingRepository.insertPaidRecurringGrantWithLedger({
      userId,
      pricingRuleSnapshotId: snapshot.id,
      grantedCredits: amount,
      cycleStartIso: periodStart,
      cycleEndIso: periodEnd,
      stripeInvoiceId: invoice.id,
      stripeCheckoutSessionId: null,
      stripeEventId: event.id,
    });
  }

  private async handleInvoicePaymentFailed(
    event: StripeWebhookEventPayload,
    stripe: MontiStripeClient,
  ): Promise<void> {
    const invoice = event.data.object as InvoiceLike;
    const subscriptionId = stripeRefId(invoice.subscription);
    if (!subscriptionId) {
      return;
    }
    const customerId = stripeRefId(invoice.customer);
    if (!customerId) {
      return;
    }
    const userId = await this.billingRepository.findUserIdByStripeCustomerId(customerId);
    if (!userId) {
      return;
    }
    const subRaw = await stripe.subscriptions.retrieve(subscriptionId);
    const sub = asSubscriptionLike(subRaw);
    await this.syncSubscriptionMirror(userId, sub);
  }

  private async handleSubscriptionLifecycle(event: StripeWebhookEventPayload): Promise<void> {
    const sub = event.data.object as SubscriptionLike;
    const customerId = stripeRefId(sub.customer);
    if (!customerId) {
      return;
    }
    const userId = await this.billingRepository.findUserIdByStripeCustomerId(customerId);
    if (!userId) {
      this.logger.warn(`Subscription ${sub.id}: no Monti user for customer ${customerId}`);
      return;
    }

    await this.syncSubscriptionMirror(userId, sub);
  }

  private async syncSubscriptionMirror(userId: string, sub: SubscriptionLike): Promise<void> {
    const firstItem = sub.items?.data?.[0];
    const periodStart = sub.current_period_start ?? firstItem?.current_period_start ?? null;
    const periodEnd = sub.current_period_end ?? firstItem?.current_period_end ?? null;
    // API 2026-03-25.dahlia: portal cancellation sets cancel_at instead of cancel_at_period_end
    const cancelAtPeriodEnd = (sub.cancel_at_period_end ?? false) || (sub.cancel_at != null && sub.cancel_at > 0);
    await this.billingRepository.upsertBillingSubscription({
      userId,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodStartIso: stripeUnixSecondsToIso(periodStart),
      currentPeriodEndIso: stripeUnixSecondsToIso(periodEnd),
      cancelAtPeriodEnd,
    });
  }

  private async ensureTopupGrant(session: CheckoutSessionLike, stripeEventId: string): Promise<void> {
    const userId = session.client_reference_id ?? session.metadata?.monti_user_id ?? null;
    if (!userId) {
      return;
    }

    const existing = await this.billingRepository.findCreditGrantByStripeCheckoutSessionId(session.id);
    if (existing) {
      return;
    }

    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      this.config.launchPricingVersionKey,
    );
    if (!snapshot) {
      throw new Error(`Missing pricing_rule_snapshots row for ${this.config.launchPricingVersionKey}`);
    }

    await this.billingRepository.insertTopupGrantWithLedger({
      userId,
      pricingRuleSnapshotId: snapshot.id,
      grantedCredits: this.config.launchCatalog.topupCredits,
      stripeCheckoutSessionId: session.id,
      stripeEventId,
    });
  }
}
