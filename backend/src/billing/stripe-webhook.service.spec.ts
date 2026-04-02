import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { StripeService } from './stripe.service';
import type { StripeWebhookEventPayload } from './stripe-webhook.types';
import { StripeWebhookService } from './stripe-webhook.service';

describe('StripeWebhookService', () => {
  const makeEvent = (type: string): StripeWebhookEventPayload => ({
    id: 'evt_test_1',
    type,
    data: { object: { id: 'obj_1' } },
  });

  it('returns duplicate when webhook row already exists', async () => {
    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(false),
      updateWebhookEventByStripeEventId: jest.fn(),
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50 },
    } as BillingConfigService;

    const stripeService = {
      requireStripe: jest.fn(),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    await expect(service.processVerifiedEvent(makeEvent('charge.succeeded'))).resolves.toBe('duplicate');
    expect(billingRepository.tryInsertWebhookEventReceived).toHaveBeenCalled();
    expect(billingRepository.updateWebhookEventByStripeEventId).not.toHaveBeenCalled();
    expect(stripeService.requireStripe).not.toHaveBeenCalled();
  });

  it('marks processed for ignored event types without calling Stripe API', async () => {
    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(true),
      updateWebhookEventByStripeEventId: jest.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50 },
    } as BillingConfigService;

    const stripeService = {
      requireStripe: jest.fn(),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    await expect(service.processVerifiedEvent(makeEvent('charge.succeeded'))).resolves.toBe('processed');
    expect(stripeService.requireStripe).not.toHaveBeenCalled();
    expect(billingRepository.updateWebhookEventByStripeEventId).toHaveBeenCalledWith(
      'evt_test_1',
      expect.objectContaining({ processing_status: 'processed' }),
    );
  });

  it('invoice.paid: resolves user from subscription metadata when customer mapping missing, creates grant and repairs mapping', async () => {
    const upsertBillingCustomerStripeId = jest.fn().mockResolvedValue(undefined);
    const insertPaidRecurringGrantWithLedger = jest.fn().mockResolvedValue(undefined);
    const upsertBillingSubscription = jest.fn().mockResolvedValue(undefined);
    const snapshot = { id: 'snap-1', version_key: 'launch-v1', rules_json: null };

    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(true),
      updateWebhookEventByStripeEventId: jest.fn().mockResolvedValue(undefined),
      findUserIdByStripeCustomerId: jest.fn().mockResolvedValue(null),
      upsertBillingCustomerStripeId,
      upsertBillingSubscription,
      findCreditGrantByStripeInvoiceId: jest.fn().mockResolvedValue(null),
      findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue(snapshot),
      insertPaidRecurringGrantWithLedger,
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50, freeMonthlyCredits: 15 },
    } as BillingConfigService;

    const sub = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      metadata: { monti_user_id: 'user-from-meta' },
      items: { data: [{ current_period_start: 1000, current_period_end: 2000 }] },
      cancel_at_period_end: false,
    };

    const stripeService = {
      requireStripe: jest.fn().mockReturnValue({
        subscriptions: { retrieve: jest.fn().mockResolvedValue(sub) },
      }),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    const event: StripeWebhookEventPayload = {
      id: 'evt_inv_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          subscription: 'sub_1',
          customer: 'cus_1',
          amount_paid: 1000,
        },
      },
    };

    await expect(service.processVerifiedEvent(event)).resolves.toBe('processed');
    expect(upsertBillingCustomerStripeId).toHaveBeenCalledWith('user-from-meta', 'cus_1');
    expect(insertPaidRecurringGrantWithLedger).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-from-meta', grantedCredits: 150 }),
    );
  });

  it('invoice.paid: warns and returns without grant when both customer mapping and subscription metadata are missing', async () => {
    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(true),
      updateWebhookEventByStripeEventId: jest.fn().mockResolvedValue(undefined),
      findUserIdByStripeCustomerId: jest.fn().mockResolvedValue(null),
      upsertBillingSubscription: jest.fn().mockResolvedValue(undefined),
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50, freeMonthlyCredits: 15 },
    } as BillingConfigService;

    const sub = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      metadata: {},
      items: { data: [{ current_period_start: 1000, current_period_end: 2000 }] },
      cancel_at_period_end: false,
    };

    const stripeService = {
      requireStripe: jest.fn().mockReturnValue({
        subscriptions: { retrieve: jest.fn().mockResolvedValue(sub) },
      }),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    const event: StripeWebhookEventPayload = {
      id: 'evt_inv_2',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_2',
          subscription: 'sub_1',
          customer: 'cus_unknown',
          amount_paid: 1000,
        },
      },
    };

    await expect(service.processVerifiedEvent(event)).resolves.toBe('processed');
    expect(billingRepository.updateWebhookEventByStripeEventId).toHaveBeenCalledWith(
      'evt_inv_2',
      expect.objectContaining({ processing_status: 'processed' }),
    );
  });

  it('checkout.session.completed (subscription): upserts billing_customers.stripe_customer_id from session customer', async () => {
    const upsertBillingCustomerStripeId = jest.fn().mockResolvedValue(undefined);
    const upsertBillingSubscription = jest.fn().mockResolvedValue(undefined);

    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(true),
      updateWebhookEventByStripeEventId: jest.fn().mockResolvedValue(undefined),
      upsertBillingSubscription,
      upsertBillingCustomerStripeId,
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50, freeMonthlyCredits: 15 },
    } as BillingConfigService;

    const sub = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      metadata: { monti_user_id: 'user-1' },
      items: { data: [{ current_period_start: 1000, current_period_end: 2000 }] },
      cancel_at_period_end: false,
    };

    const stripeService = {
      requireStripe: jest.fn().mockReturnValue({
        subscriptions: { retrieve: jest.fn().mockResolvedValue(sub) },
      }),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    const event: StripeWebhookEventPayload = {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'subscription',
          client_reference_id: 'user-1',
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    };

    await expect(service.processVerifiedEvent(event)).resolves.toBe('processed');
    expect(upsertBillingCustomerStripeId).toHaveBeenCalledWith('user-1', 'cus_1');
  });

  it('marks failed when handler throws', async () => {
    const billingRepository = {
      tryInsertWebhookEventReceived: jest.fn().mockResolvedValue(true),
      updateWebhookEventByStripeEventId: jest.fn().mockResolvedValue(undefined),
      findUserIdByStripeCustomerId: jest.fn().mockResolvedValue('user-1'),
      upsertBillingSubscription: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as BillingRepository;

    const config = {
      launchPricingVersionKey: 'launch-v1',
      launchCatalog: { paidMonthlyCredits: 150, topupCredits: 50 },
    } as BillingConfigService;

    const stripeService = {
      requireStripe: jest.fn(),
    } as unknown as StripeService;

    const service = new StripeWebhookService(config, billingRepository, stripeService);

    const event: StripeWebhookEventPayload = {
      id: 'evt_sub_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          current_period_start: 1,
          current_period_end: 2,
          cancel_at_period_end: false,
        },
      },
    };

    await expect(service.processVerifiedEvent(event)).rejects.toThrow('db down');
    expect(billingRepository.updateWebhookEventByStripeEventId).toHaveBeenNthCalledWith(
      2,
      'evt_sub_1',
      expect.objectContaining({ processing_status: 'failed', error_message: 'db down' }),
    );
  });
});
