import { InsufficientCreditsError } from '../common/errors/app-error';
import type { MontiSupabaseClient } from '../supabase/supabase.types';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { CreditReservationService } from './credit-reservation.service';

describe('CreditReservationService', () => {
  const catalog = {
    freeMonthlyCredits: 15,
    paidMonthlyCredits: 150,
    fastCredits: 1,
    qualityCredits: 5,
    topupCredits: 300,
    topupPriceUsd: 4,
    paidPlanPriceUsd: 10,
  };

  function makeService(deps: {
    billingConfig: Partial<BillingConfigService>;
    repository: Partial<InstanceType<typeof BillingRepository>>;
    rpc: MontiSupabaseClient['rpc'];
  }) {
    return new CreditReservationService(
      deps.billingConfig as BillingConfigService,
      deps.repository as BillingRepository,
      { rpc: deps.rpc } as MontiSupabaseClient,
    );
  }

  it('shouldEnforceReservation is true only when billing and enforcement are on', () => {
    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        creditEnforcementEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {},
      rpc: jest.fn(),
    });
    expect(svc.shouldEnforceReservation()).toBe(true);

    const off = makeService({
      billingConfig: {
        billingEnabled: true,
        creditEnforcementEnabled: false,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {},
      rpc: jest.fn(),
    });
    expect(off.shouldEnforceReservation()).toBe(false);
  });

  it('reserveForToolInvocation maps INSUFFICIENT_CREDITS from RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_CREDITS', code: 'P0001' },
    });
    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        creditEnforcementEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {
        findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue({
          id: 'snap-1',
          version_key: 'launch-v1',
          rules_json: {},
        }),
      },
      rpc,
    });

    await expect(
      svc.reserveForToolInvocation({
        userId: 'u1',
        toolInvocationId: '00000000-0000-0000-0000-000000000099',
        qualityTier: 'quality',
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    expect(rpc).toHaveBeenCalledWith(
      'billing_reserve_generation_credits',
      expect.objectContaining({
        p_user_id: 'u1',
        p_credits: 5,
        p_pricing_rule_snapshot_id: 'snap-1',
      }),
    );
  });

  it('reserveForToolInvocation parses multi-slice JSON from RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        slices: [
          {
            reservation_id: 'r1',
            credit_grant_id: 'g1',
            credits_reserved: 2,
          },
          {
            reservation_id: 'r2',
            credit_grant_id: 'g2',
            credits_reserved: 3,
          },
        ],
      },
      error: null,
    });
    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        creditEnforcementEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {
        findPricingRuleSnapshotByVersionKey: jest.fn().mockResolvedValue({
          id: 'snap-1',
          version_key: 'launch-v1',
          rules_json: {},
        }),
      },
      rpc,
    });

    const result = await svc.reserveForToolInvocation({
      userId: 'u1',
      toolInvocationId: '00000000-0000-0000-0000-000000000088',
      qualityTier: 'quality',
    });

    expect(result.slices).toEqual([
      { reservationId: 'r1', creditGrantId: 'g1', creditsReserved: 2 },
      { reservationId: 'r2', creditGrantId: 'g2', creditsReserved: 3 },
    ]);
    expect(result.pricingRuleSnapshotId).toBe('snap-1');
  });

  it('releaseReservation calls invocation-scoped RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    const svc = makeService({
      billingConfig: {
        billingEnabled: true,
        creditEnforcementEnabled: true,
        launchPricingVersionKey: 'launch-v1',
        launchCatalog: catalog,
      } as BillingConfigService,
      repository: {},
      rpc,
    });

    await svc.releaseReservation({
      userId: 'u1',
      toolInvocationId: '00000000-0000-0000-0000-000000000077',
      pricingRuleSnapshotId: 'snap-x',
    });

    expect(rpc).toHaveBeenCalledWith('billing_release_generation_reservation', {
      p_user_id: 'u1',
      p_tool_invocation_id: '00000000-0000-0000-0000-000000000077',
      p_pricing_rule_snapshot_id: 'snap-x',
    });
  });
});
