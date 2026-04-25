import { AppError } from '../common/errors/app-error';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripeService } from './stripe.service';

describe('StripeCheckoutService', () => {
  const user = { id: 'user-1', email: 'a@b.com', token: 't', claims: {} } as never;

  it('rejects top-up checkout when user has no active paid subscription', async () => {
    const config = {
      billingEnabled: true,
      topupsEnabled: true,
      stripeSecretKey: 'sk_test',
      stripePriceIdTopup300: 'price_top',
      billingPublicBaseUrl: 'http://localhost:3000',
      billingPortalReturnUrl: null,
    } as BillingConfigService;

    const billingRepository = {
      listBillingSubscriptionsByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as BillingRepository;

    const stripeService = {
      requireStripe: jest.fn(() => ({
        customers: { create: jest.fn().mockResolvedValue({ id: 'cus_x' }) },
        checkout: { sessions: { create: jest.fn() } },
      })),
    } as unknown as StripeService;

    const service = new StripeCheckoutService(config, stripeService, billingRepository);

    await expect(service.createTopupCheckoutSession(user)).rejects.toBeInstanceOf(AppError);
    await expect(service.createTopupCheckoutSession(user)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(stripeService.requireStripe).not.toHaveBeenCalled();
  });
});
