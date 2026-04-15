export type BillingMePlan = 'free' | 'paid';

export type BillingMeCosts = {
  fastCredits: number | null;
  qualityCredits: number | null;
};

export type BillingMeBucket = {
  id: string;
  bucketKind: string;
  source: string;
  spendableCredits: number;
  reservedCredits: number;
  grantedCredits: number;
  cycleStart: string | null;
  cycleEnd: string | null;
  createdAt: string;
};

export type BillingMeSubscription = {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
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
  /** Sum of spendable credits across recurring, top-up, and manual buckets. */
  totalSpendableCredits: number | null;
  reservedCreditsTotal: number | null;
  buckets: BillingMeBucket[];
  nextIncludedRefreshAt: string | null;
  paidPeriodEndsAt: string | null;
  subscription: BillingMeSubscription | null;
};

export type BillingMeResponse = {
  ok: true;
  data: BillingMeData;
};
