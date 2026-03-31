import type { LaunchPricingCatalog } from './billing-config.service';

export interface ResolvedPricingCosts {
  freeMonthlyCredits: number;
  paidMonthlyCredits: number;
  fastCredits: number;
  qualityCredits: number;
}

function readPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return fallback;
}

/** Merge DB snapshot rules_json with env-backed launch catalog as fallback. */
export function resolvePricingFromSnapshot(
  rulesJson: Record<string, unknown> | null | undefined,
  catalog: LaunchPricingCatalog,
): ResolvedPricingCosts {
  const j = rulesJson ?? {};
  return {
    freeMonthlyCredits: readPositiveInt(j.freeMonthlyCredits, catalog.freeMonthlyCredits),
    paidMonthlyCredits: readPositiveInt(j.paidMonthlyCredits, catalog.paidMonthlyCredits),
    fastCredits: readPositiveInt(j.fastCredits, catalog.fastCredits),
    qualityCredits: readPositiveInt(j.qualityCredits, catalog.qualityCredits),
  };
}

export function creditsForQualityTier(pricing: ResolvedPricingCosts, tier: 'fast' | 'quality'): number {
  return tier === 'fast' ? pricing.fastCredits : pricing.qualityCredits;
}
