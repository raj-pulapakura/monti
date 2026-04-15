import { Test } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { BillingController } from './billing.controller';
import { EntitlementService } from './entitlement.service';
import { StripeCheckoutService } from './stripe-checkout.service';

describe('BillingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const stripeCheckout = {
    createSubscriptionCheckoutSession: jest.fn(),
    createTopupCheckoutSession: jest.fn(),
    createBillingPortalSession: jest.fn(),
  };

  const moduleWithStripe = (entitlements: { getBillingMe: jest.Mock }) =>
    Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: EntitlementService, useValue: entitlements },
        { provide: StripeCheckoutService, useValue: stripeCheckout },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

  it('returns ok envelope and forwards user id to entitlements', async () => {
    const payload = {
      billingEnabled: true,
      freeCreditGrantsEnabled: true,
      plan: 'free' as const,
      pricingRuleVersionKey: 'launch-v1',
      costs: { fastCredits: 1, qualityCredits: 5 },
      includedCreditsAvailable: 10,
      topupCreditsAvailable: 0,
      totalSpendableCredits: 10,
      reservedCreditsTotal: 0,
      buckets: [],
      nextIncludedRefreshAt: '2025-02-01T00:00:00.000Z',
      paidPeriodEndsAt: null,
    };

    const entitlements = {
      getBillingMe: jest.fn().mockResolvedValue(payload),
    };

    const moduleRef = await moduleWithStripe(entitlements);

    const controller = moduleRef.get(BillingController);
    const result = await controller.getMe({ id: 'user-abc' } as never);

    expect(result).toEqual({ ok: true, data: payload });
    expect(entitlements.getBillingMe).toHaveBeenCalledWith('user-abc');
  });

  it('returns billing-disabled shape from service without error', async () => {
    const payload = {
      billingEnabled: false,
      freeCreditGrantsEnabled: false,
      plan: 'free' as const,
      pricingRuleVersionKey: null,
      costs: { fastCredits: null, qualityCredits: null },
      includedCreditsAvailable: null,
      topupCreditsAvailable: null,
      totalSpendableCredits: null,
      reservedCreditsTotal: null,
      buckets: [],
      nextIncludedRefreshAt: null,
      paidPeriodEndsAt: null,
    };

    const entitlements = {
      getBillingMe: jest.fn().mockResolvedValue(payload),
    };

    const moduleRef = await moduleWithStripe(entitlements);

    const controller = moduleRef.get(BillingController);
    const result = await controller.getMe({ id: 'user-1' } as never);

    expect(result).toEqual({ ok: true, data: payload });
    expect(result.data.billingEnabled).toBe(false);
  });

  it('returns checkout subscription url from Stripe checkout service', async () => {
    stripeCheckout.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    const moduleRef = await moduleWithStripe({
      getBillingMe: jest.fn(),
    });
    const controller = moduleRef.get(BillingController);
    const user = { id: 'u1', email: 'a@b.com', token: 't', claims: {} } as never;

    await expect(controller.postCheckoutSubscription(user)).resolves.toEqual({
      ok: true,
      data: { url: 'https://checkout.stripe.com/c/pay/cs_test_123' },
    });
    expect(stripeCheckout.createSubscriptionCheckoutSession).toHaveBeenCalledWith(user);
  });

  it('returns portal url from Stripe checkout service', async () => {
    stripeCheckout.createBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/abc',
    });

    const moduleRef = await moduleWithStripe({
      getBillingMe: jest.fn(),
    });
    const controller = moduleRef.get(BillingController);
    const user = { id: 'u1', email: 'a@b.com', token: 't', claims: {} } as never;

    await expect(controller.postPortal(user, { returnUrl: 'https://app.example.com' })).resolves.toEqual({
      ok: true,
      data: { url: 'https://billing.stripe.com/session/abc' },
    });
    expect(stripeCheckout.createBillingPortalSession).toHaveBeenCalledWith(
      user,
      'https://app.example.com',
    );
  });
});
