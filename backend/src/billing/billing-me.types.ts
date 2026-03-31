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

export interface BillingMeDataDto {
  billingEnabled: boolean;
  freeCreditGrantsEnabled: boolean;
  plan: BillingMePlan;
  pricingRuleVersionKey: string | null;
  costs: BillingMeCostsDto;
  includedCreditsAvailable: number | null;
  topupCreditsAvailable: number | null;
  reservedCreditsTotal: number | null;
  buckets: BillingMeBucketDto[];
  nextIncludedRefreshAt: string | null;
  paidPeriodEndsAt: string | null;
}
