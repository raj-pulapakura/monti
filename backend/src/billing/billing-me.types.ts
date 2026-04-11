export type BillingMePlan = 'free' | 'paid';

export interface BillingMeBucketDto {
  id: string;
  bucketKind: string;
  source: string;
  spendableCredits: number;
  reservedCredits: number;
  grantedCredits: number;
  cycleStart: string | null;
  cycleEnd: string | null;
  createdAt: string;
}

export interface BillingMeCostsDto {
  fastCredits: number | null;
  qualityCredits: number | null;
}

export interface BillingMeSubscriptionDto {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingMeDataDto {
  billingEnabled: boolean;
  freeCreditGrantsEnabled: boolean;
  plan: BillingMePlan;
  pricingRuleVersionKey: string | null;
  costs: BillingMeCostsDto;
  includedCreditsAvailable: number | null;
  includedCreditsTotal: number | null;
  topupCreditsAvailable: number | null;
  topupCreditsTotal: number | null;
  reservedCreditsTotal: number | null;
  buckets: BillingMeBucketDto[];
  nextIncludedRefreshAt: string | null;
  paidPeriodEndsAt: string | null;
  /** Present when the user has an active paid subscription period (mirrored from Stripe). */
  subscription: BillingMeSubscriptionDto | null;
}
