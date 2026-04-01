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
