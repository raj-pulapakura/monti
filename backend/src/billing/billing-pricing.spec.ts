import { creditsForQualityTier, resolvePricingFromSnapshot } from './billing-pricing';

const catalog = {
  freeMonthlyCredits: 15,
  paidMonthlyCredits: 150,
  fastCredits: 1,
  qualityCredits: 5,
  topupCredits: 50,
  topupPriceUsd: 4,
  paidPlanPriceUsd: 10,
};

describe('billing-pricing', () => {
  it('creditsForQualityTier maps tier to snapshot-backed costs', () => {
    const p = resolvePricingFromSnapshot({ fastCredits: 2, qualityCredits: 7 }, catalog);
    expect(creditsForQualityTier(p, 'fast')).toBe(2);
    expect(creditsForQualityTier(p, 'quality')).toBe(7);
  });
});
