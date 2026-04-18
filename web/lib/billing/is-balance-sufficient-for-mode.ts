import type { BillingMeData } from '@/lib/api/billing-me';
import type { GenerationMode } from '@/lib/chat/generation-mode';

/**
 * Whether the user can submit for the selected mode.
 */
export function isBalanceSufficientForMode(
  billingData: BillingMeData,
  selectedMode: GenerationMode,
): boolean {
  if (!billingData.billingEnabled) {
    return true;
  }

  const included = billingData.includedCreditsAvailable;
  const topup = billingData.topupCreditsAvailable;
  const total =
    billingData.totalSpendableCredits != null
      ? billingData.totalSpendableCredits
      : included != null && topup != null
        ? included + topup
        : null;
  if (total == null) {
    return true;
  }
  const fast = billingData.costs.fastCredits;
  const quality = billingData.costs.qualityCredits;
  if (fast == null || quality == null) {
    return true;
  }

  if (selectedMode === 'fast') {
    return total >= fast;
  }
  return total >= quality;
}

/** Pre-submit gate: user must afford at least the Draft (fast) tier. */
export function isBalanceSufficientForMinimumTier(billingData: BillingMeData): boolean {
  return isBalanceSufficientForMode(billingData, 'fast');
}
