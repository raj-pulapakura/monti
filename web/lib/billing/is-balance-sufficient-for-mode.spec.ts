import { describe, expect, it } from 'vitest';
import {
  isBalanceSufficientForMinimumTier,
  isBalanceSufficientForMode,
} from './is-balance-sufficient-for-mode';
import type { BillingMeData } from '@/lib/api/billing-me';

function baseBilling(overrides: Partial<BillingMeData> = {}): BillingMeData {
  const merged: BillingMeData = {
    billingEnabled: true,
    freeCreditGrantsEnabled: true,
    plan: 'free',
    pricingRuleVersionKey: 'v1',
    costs: { fastCredits: 1, qualityCredits: 5 },
    includedCreditsAvailable: 0,
    includedCreditsTotal: 0,
    topupCreditsAvailable: 0,
    topupCreditsTotal: 0,
    totalSpendableCredits: 0,
    reservedCreditsTotal: 0,
    buckets: [],
    nextIncludedRefreshAt: null,
    paidPeriodEndsAt: null,
    subscription: null,
    ...overrides,
  };
  if (overrides.totalSpendableCredits === undefined) {
    merged.totalSpendableCredits =
      (merged.includedCreditsAvailable ?? 0) + (merged.topupCreditsAvailable ?? 0);
  }
  return merged;
}

describe('isBalanceSufficientForMinimumTier', () => {
  it('requires at least fast-tier credits when billing is enabled', () => {
    expect(
      isBalanceSufficientForMinimumTier(
        baseBilling({ includedCreditsAvailable: 0, topupCreditsAvailable: 0 }),
      ),
    ).toBe(false);
    expect(
      isBalanceSufficientForMinimumTier(
        baseBilling({ includedCreditsAvailable: 1, topupCreditsAvailable: 0 }),
      ),
    ).toBe(true);
  });
});

describe('isBalanceSufficientForMode', () => {

  it('requires full quality cost for quality mode', () => {
    expect(
      isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 4, topupCreditsAvailable: 0 }), 'quality'),
    ).toBe(false);
    expect(
      isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 5, topupCreditsAvailable: 0 }), 'quality'),
    ).toBe(true);
  });

  it('counts manual credits toward the spendable total', () => {
    expect(
      isBalanceSufficientForMode(
        baseBilling({
          includedCreditsAvailable: 0,
          topupCreditsAvailable: 0,
          totalSpendableCredits: 5,
        }),
        'quality',
      ),
    ).toBe(true);
  });
});
