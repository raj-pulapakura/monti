import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { isPaidEntitlementActive } from './entitlement-math';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeCheckoutService {
  private readonly logger = new Logger(StripeCheckoutService.name);

  constructor(
    private readonly config: BillingConfigService,
    private readonly stripeService: StripeService,
    private readonly billingRepository: BillingRepository,
  ) {}

  async createSubscriptionCheckoutSession(user: AuthenticatedUser): Promise<{ url: string }> {
    this.assertBillingReadyForCheckout();
    const stripe = this.stripeService.requireStripe();
    const priceId = this.config.stripePriceIdPaidMonthly;
    if (!priceId) {
      throw new AppError('INTERNAL_ERROR', 'STRIPE_PRICE_ID_PAID_MONTHLY is not configured.', 503);
    }

    const { successUrl, cancelUrl } = this.requireCheckoutUrls();
    const stripeCustomerId = await this.ensureStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        monti_user_id: user.id,
        monti_checkout_intent: 'subscription',
      },
      subscription_data: {
        metadata: { monti_user_id: user.id },
      },
    });

    if (!session.url) {
      throw new AppError('INTERNAL_ERROR', 'Stripe Checkout session missing redirect URL.', 502);
    }

    await this.billingRepository.insertBillingCheckoutSession({
      user_id: user.id,
      stripe_checkout_session_id: session.id,
      mode: 'subscription',
      intent: 'subscription',
    });
    this.logger.log(
      JSON.stringify({ event: 'billing.checkout_session_created', userId: user.id, type: 'subscription' }),
    );

    return { url: session.url };
  }

  async createTopupCheckoutSession(user: AuthenticatedUser): Promise<{ url: string }> {
    this.assertBillingReadyForCheckout();
    if (!this.config.topupsEnabled) {
      throw new AppError('VALIDATION_ERROR', 'Top-up purchases are disabled.', 400);
    }

    const priceId = this.config.stripePriceIdTopup50;
    if (!priceId) {
      throw new AppError('INTERNAL_ERROR', 'STRIPE_PRICE_ID_TOPUP_50 is not configured.', 503);
    }

    const nowMs = Date.now();
    const subs = await this.billingRepository.listBillingSubscriptionsByUserId(user.id);
    if (!isPaidEntitlementActive(subs, nowMs)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Top-ups require an active paid subscription. Reactivate your plan first.',
        400,
      );
    }

    const stripe = this.stripeService.requireStripe();

    const { successUrl, cancelUrl } = this.requireCheckoutUrls();
    const stripeCustomerId = await this.ensureStripeCustomer(user);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        monti_user_id: user.id,
        monti_checkout_intent: 'topup',
      },
    });

    if (!session.url) {
      throw new AppError('INTERNAL_ERROR', 'Stripe Checkout session missing redirect URL.', 502);
    }

    await this.billingRepository.insertBillingCheckoutSession({
      user_id: user.id,
      stripe_checkout_session_id: session.id,
      mode: 'payment',
      intent: 'topup',
    });
    this.logger.log(JSON.stringify({ event: 'billing.checkout_session_created', userId: user.id, type: 'topup' }));

    return { url: session.url };
  }

  async createBillingPortalSession(
    user: AuthenticatedUser,
    returnUrlOverride?: string,
  ): Promise<{ url: string }> {
    if (!this.config.billingEnabled) {
      throw new AppError('VALIDATION_ERROR', 'Billing is disabled.', 400);
    }
    if (!this.config.billingPortalEnabled) {
      throw new AppError('VALIDATION_ERROR', 'Customer portal is disabled.', 400);
    }

    const stripe = this.stripeService.requireStripe();
    const row = await this.billingRepository.findBillingCustomerByUserId(user.id);
    if (!row?.stripe_customer_id) {
      throw new AppError(
        'VALIDATION_ERROR',
        'No Stripe billing account yet. Start a paid subscription from pricing first.',
        400,
      );
    }

    const returnUrl = returnUrlOverride?.trim() || this.resolvePortalReturnUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: returnUrl,
    });

    if (!session.url) {
      throw new AppError('INTERNAL_ERROR', 'Stripe Billing Portal session missing URL.', 502);
    }
    this.logger.log(JSON.stringify({ event: 'billing.portal_session_created', userId: user.id }));

    return { url: session.url };
  }

  private assertBillingReadyForCheckout(): void {
    if (!this.config.billingEnabled) {
      throw new AppError('VALIDATION_ERROR', 'Billing is disabled.', 400);
    }
    if (!this.config.stripeSecretKey) {
      throw new AppError('INTERNAL_ERROR', 'Stripe is not configured for this environment.', 503);
    }
  }

  private requireCheckoutUrls(): { successUrl: string; cancelUrl: string } {
    const base = this.config.billingPublicBaseUrl?.replace(/\/$/, '') ?? '';
    if (!base) {
      throw new AppError(
        'INTERNAL_ERROR',
        'BILLING_PUBLIC_BASE_URL is required for Checkout redirects.',
        503,
      );
    }
    return {
      successUrl: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/checkout/cancel`,
    };
  }

  private resolvePortalReturnUrl(): string {
    const explicit = this.config.billingPortalReturnUrl?.replace(/\/$/, '') ?? '';
    if (explicit) {
      return explicit;
    }
    const base = this.config.billingPublicBaseUrl?.replace(/\/$/, '') ?? '';
    if (!base) {
      throw new AppError(
        'INTERNAL_ERROR',
        'Set BILLING_PORTAL_RETURN_URL or BILLING_PUBLIC_BASE_URL for Customer Portal.',
        503,
      );
    }
    return `${base}/`;
  }

  private async ensureStripeCustomer(user: AuthenticatedUser): Promise<string> {
    const stripe = this.stripeService.requireStripe();
    const row = await this.billingRepository.ensureBillingCustomerRow(user.id);
    if (row.stripe_customer_id) {
      return row.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { monti_user_id: user.id },
    });

    await this.billingRepository.updateBillingCustomerStripeId(user.id, customer.id);
    return customer.id;
  }
}
