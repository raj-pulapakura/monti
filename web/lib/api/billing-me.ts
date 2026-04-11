export type BillingMePlan = 'free' | 'paid';

export type BillingMeCosts = {
  fastCredits: number | null;
  qualityCredits: number | null;
};

export type BillingMeData = {
  billingEnabled: boolean;
  freeCreditGrantsEnabled: boolean;
  plan: BillingMePlan;
  pricingRuleVersionKey: string | null;
  costs: BillingMeCosts;
  includedCreditsAvailable: number | null;
  includedCreditsTotal: number | null;
  topupCreditsAvailable: number | null;
  topupCreditsTotal: number | null;
  reservedCreditsTotal: number | null;
  nextIncludedRefreshAt: string | null;
  paidPeriodEndsAt: string | null;
};

export type BillingMeResponse = {
  ok: true;
  data: BillingMeData;
};
