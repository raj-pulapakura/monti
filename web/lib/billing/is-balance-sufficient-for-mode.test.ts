import { describe, expect, it } from 'vitest';
import { isBalanceSufficientForMode } from './is-balance-sufficient-for-mode';
import type { BillingMeData } from '@/lib/api/billing-me';

function baseBilling(overrides: Partial<BillingMeData> = {}): BillingMeData {
  return {
    billingEnabled: true,
    freeCreditGrantsEnabled: true,
    plan: 'free',
    pricingRuleVersionKey: 'v1',
    costs: { fastCredits: 1, qualityCredits: 5 },
    includedCreditsAvailable: 0,
    topupCreditsAvailable: 0,
    reservedCreditsTotal: 0,
    nextIncludedRefreshAt: null,
    paidPeriodEndsAt: null,
    ...overrides,
  };
}

describe('isBalanceSufficientForMode', () => {
  it('treats auto as requiring at least fast-tier credits', () => {
    expect(isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 0, topupCreditsAvailable: 0 }), 'auto')).toBe(
      false,
    );
    expect(isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 1, topupCreditsAvailable: 0 }), 'auto')).toBe(
      true,
    );
  });

  it('requires full quality cost for quality mode', () => {
    expect(
      isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 4, topupCreditsAvailable: 0 }), 'quality'),
    ).toBe(false);
    expect(
      isBalanceSufficientForMode(baseBilling({ includedCreditsAvailable: 5, topupCreditsAvailable: 0 }), 'quality'),
    ).toBe(true);
  });
});
