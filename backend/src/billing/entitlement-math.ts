/** UTC calendar month bounds for free recurring grants (design: anchor in UTC). */
export function utcCalendarMonthRangeUtcMs(referenceMs: number): {
  startMs: number;
  endMs: number;
} {
  const ref = new Date(referenceMs);
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const startMs = Date.UTC(y, m, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(y, m + 1, 1, 0, 0, 0, 0);
  return { startMs, endMs };
}

export function nextUtcMonthStartMs(referenceMs: number): number {
  const { endMs } = utcCalendarMonthRangeUtcMs(referenceMs);
  return endMs;
}

export type GrantRowLike = {
  id: string;
  bucket_kind: 'recurring_free' | 'recurring_paid' | 'topup' | 'manual';
  source: string;
  cycle_start: string | null;
  cycle_end: string | null;
  remaining_credits: number;
  reserved_credits: number;
  created_at: string;
};

export function spendableOnGrant(grant: Pick<GrantRowLike, 'remaining_credits' | 'reserved_credits'>): number {
  return Math.max(0, grant.remaining_credits - grant.reserved_credits);
}

export function isPaidEntitlementActive(
  subscriptions: { current_period_end: string | null }[],
  nowMs: number,
): boolean {
  return subscriptions.some((row) => {
    if (!row.current_period_end) {
      return false;
    }
    return Date.parse(row.current_period_end) > nowMs;
  });
}

export function paidPeriodEndsAtIso(
  subscriptions: { current_period_end: string | null }[],
  nowMs: number,
): string | null {
  const ends = subscriptions
    .map((s) => s.current_period_end)
    .filter((v): v is string => v != null && Date.parse(v) > nowMs)
    .map((v) => Date.parse(v));
  if (ends.length === 0) {
    return null;
  }
  return new Date(Math.max(...ends)).toISOString();
}

function cycleStillOpen(grant: GrantRowLike, nowMs: number): boolean {
  if (!grant.cycle_end) {
    return true;
  }
  return Date.parse(grant.cycle_end) > nowMs;
}

export function isRecurringFreeEligible(grant: GrantRowLike, nowMs: number): boolean {
  if (grant.bucket_kind !== 'recurring_free') {
    return false;
  }
  return cycleStillOpen(grant, nowMs) && spendableOnGrant(grant) > 0;
}

export function isRecurringPaidEligible(grant: GrantRowLike, nowMs: number, paidActive: boolean): boolean {
  if (grant.bucket_kind !== 'recurring_paid') {
    return false;
  }
  if (!paidActive) {
    return false;
  }
  return cycleStillOpen(grant, nowMs) && spendableOnGrant(grant) > 0;
}

export function isTopupEligible(grant: GrantRowLike, nowMs: number, paidActive: boolean): boolean {
  if (grant.bucket_kind !== 'topup') {
    return false;
  }
  if (!paidActive) {
    return false;
  }
  return spendableOnGrant(grant) > 0;
}

export function isManualEligible(grant: GrantRowLike, nowMs: number): boolean {
  if (grant.bucket_kind !== 'manual') {
    return false;
  }
  if (grant.cycle_end && Date.parse(grant.cycle_end) <= nowMs) {
    return false;
  }
  return spendableOnGrant(grant) > 0;
}

export function sortBucketsForDisplay(grants: GrantRowLike[]): GrantRowLike[] {
  const recurring = grants.filter((g) => g.bucket_kind === 'recurring_free' || g.bucket_kind === 'recurring_paid');
  const topup = grants.filter((g) => g.bucket_kind === 'topup');
  const manual = grants.filter((g) => g.bucket_kind === 'manual');

  recurring.sort((a, b) => {
    const ae = a.cycle_end ? Date.parse(a.cycle_end) : 0;
    const be = b.cycle_end ? Date.parse(b.cycle_end) : 0;
    return ae - be;
  });
  topup.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  manual.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  return [...recurring, ...topup, ...manual];
}

export function aggregateIncludedCreditsAvailable(
  grants: GrantRowLike[],
  nowMs: number,
  paidActive: boolean,
): number {
  let sum = 0;
  for (const g of grants) {
    if (isRecurringFreeEligible(g, nowMs)) {
      sum += spendableOnGrant(g);
    } else if (isRecurringPaidEligible(g, nowMs, paidActive)) {
      sum += spendableOnGrant(g);
    }
  }
  return sum;
}

export function aggregateTopupCreditsAvailable(grants: GrantRowLike[], nowMs: number, paidActive: boolean): number {
  if (!paidActive) {
    return 0;
  }
  let sum = 0;
  for (const g of grants) {
    if (isTopupEligible(g, nowMs, paidActive)) {
      sum += spendableOnGrant(g);
    }
  }
  return sum;
}

export function aggregateReservedCredits(grants: GrantRowLike[], nowMs: number): number {
  return grants
    .filter((g) => {
      if (g.bucket_kind === 'manual' || g.bucket_kind === 'topup') {
        return true;
      }
      return cycleStillOpen(g, nowMs);
    })
    .reduce((acc, g) => acc + g.reserved_credits, 0);
}

/** Total unreserved credits across included, top-up, and manual buckets (same pool as reservation RPC). */
export function aggregateTotalSpendableCredits(
  grants: GrantRowLike[],
  nowMs: number,
  paidActive: boolean,
): number {
  let sum = 0;
  for (const g of grants) {
    if (isRecurringFreeEligible(g, nowMs)) {
      sum += spendableOnGrant(g);
    } else if (isRecurringPaidEligible(g, nowMs, paidActive)) {
      sum += spendableOnGrant(g);
    } else if (isTopupEligible(g, nowMs, paidActive)) {
      sum += spendableOnGrant(g);
    } else if (isManualEligible(g, nowMs)) {
      sum += spendableOnGrant(g);
    }
  }
  return sum;
}
