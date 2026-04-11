import type { BillingMeData } from '@/lib/api/billing-me';
import type { GenerationMode } from '@/lib/chat/generation-mode';

/**
 * Whether the user can submit for the selected mode. For `auto`, matches server behavior:
 * fast tier is the minimum needed (quality may downgrade to fast server-side).
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
  if (included == null || topup == null) {
    return true;
  }

  const total = included + topup;
  const fast = billingData.costs.fastCredits;
  const quality = billingData.costs.qualityCredits;
  if (fast == null || quality == null) {
    return true;
  }

  if (selectedMode === 'fast') {
    return total >= fast;
  }
  if (selectedMode === 'quality') {
    return total >= quality;
  }
  return total >= fast;
}
