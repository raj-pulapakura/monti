import { Test } from '@nestjs/testing';
import { AuthGuard } from '../auth/auth.guard';
import { BillingController } from './billing.controller';
import { EntitlementService } from './entitlement.service';

describe('BillingController', () => {
  it('returns ok envelope and forwards user id to entitlements', async () => {
    const payload = {
      billingEnabled: true,
      freeCreditGrantsEnabled: true,
      plan: 'free' as const,
      pricingRuleVersionKey: 'launch-v1',
      costs: { fastCredits: 1, qualityCredits: 5 },
      includedCreditsAvailable: 10,
      topupCreditsAvailable: 0,
      reservedCreditsTotal: 0,
      buckets: [],
      nextIncludedRefreshAt: '2025-02-01T00:00:00.000Z',
      paidPeriodEndsAt: null,
    };

    const entitlements = {
      getBillingMe: jest.fn().mockResolvedValue(payload),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: EntitlementService, useValue: entitlements }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
      reservedCreditsTotal: null,
      buckets: [],
      nextIncludedRefreshAt: null,
      paidPeriodEndsAt: null,
    };

    const entitlements = {
      getBillingMe: jest.fn().mockResolvedValue(payload),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: EntitlementService, useValue: entitlements }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(BillingController);
    const result = await controller.getMe({ id: 'user-1' } as never);

    expect(result).toEqual({ ok: true, data: payload });
    expect(result.data.billingEnabled).toBe(false);
  });
});
