import {
  aggregateIncludedCreditsAvailable,
  aggregateReservedCredits,
  aggregateTopupCreditsAvailable,
  isPaidEntitlementActive,
  paidPeriodEndsAtIso,
  sortBucketsForDisplay,
  spendableOnGrant,
  utcCalendarMonthRangeUtcMs,
  nextUtcMonthStartMs,
  type GrantRowLike,
} from './entitlement-math';

function grant(partial: Partial<GrantRowLike> & Pick<GrantRowLike, 'id' | 'bucket_kind'>): GrantRowLike {
  return {
    source: 'test',
    cycle_start: null,
    cycle_end: null,
    remaining_credits: 10,
    reserved_credits: 0,
    created_at: '2025-06-01T12:00:00.000Z',
    ...partial,
  };
}

describe('entitlement-math', () => {
  describe('utcCalendarMonthRangeUtcMs / nextUtcMonthStartMs', () => {
    it('returns UTC month bounds for a mid-month instant', () => {
      const ref = Date.UTC(2025, 5, 15, 12, 0, 0, 0);
      const { startMs, endMs } = utcCalendarMonthRangeUtcMs(ref);
      expect(startMs).toBe(Date.UTC(2025, 5, 1, 0, 0, 0, 0));
      expect(endMs).toBe(Date.UTC(2025, 6, 1, 0, 0, 0, 0));
      expect(nextUtcMonthStartMs(ref)).toBe(endMs);
    });
  });

  describe('spendableOnGrant', () => {
    it('clamps at zero when reserved exceeds remaining', () => {
      expect(spendableOnGrant({ remaining_credits: 3, reserved_credits: 5 })).toBe(0);
    });

    it('returns remaining minus reserved when positive', () => {
      expect(spendableOnGrant({ remaining_credits: 10, reserved_credits: 3 })).toBe(7);
    });
  });

  describe('isPaidEntitlementActive / paidPeriodEndsAtIso', () => {
    const now = Date.UTC(2025, 0, 10, 0, 0, 0, 0);

    it('is false when period end is in the past', () => {
      expect(
        isPaidEntitlementActive([{ current_period_end: '2025-01-05T00:00:00.000Z' }], now),
      ).toBe(false);
    });

    it('is true when any subscription period end is after now', () => {
      expect(
        isPaidEntitlementActive([{ current_period_end: '2025-02-01T00:00:00.000Z' }], now),
      ).toBe(true);
    });

    it('paidPeriodEndsAtIso picks the latest active period end', () => {
      expect(
        paidPeriodEndsAtIso(
          [
            { current_period_end: '2025-01-20T00:00:00.000Z' },
            { current_period_end: '2025-02-01T00:00:00.000Z' },
          ],
          now,
        ),
      ).toBe(new Date(Date.UTC(2025, 1, 1, 0, 0, 0, 0)).toISOString());
    });
  });

  describe('aggregates and top-up freeze', () => {
    const now = Date.UTC(2025, 6, 15, 0, 0, 0, 0);
    const cycleEndFuture = '2025-08-01T00:00:00.000Z';

    it('includes recurring_free when cycle open and spendable > 0', () => {
      const g = grant({
        id: 'a',
        bucket_kind: 'recurring_free',
        cycle_end: cycleEndFuture,
        remaining_credits: 5,
        reserved_credits: 0,
      });
      expect(aggregateIncludedCreditsAvailable([g], now, false)).toBe(5);
    });

    it('excludes recurring_free when spendable is zero', () => {
      const g = grant({
        id: 'a',
        bucket_kind: 'recurring_free',
        cycle_end: cycleEndFuture,
        remaining_credits: 2,
        reserved_credits: 2,
      });
      expect(aggregateIncludedCreditsAvailable([g], now, false)).toBe(0);
    });

    it('freezes top-ups when paid is not active', () => {
      const g = grant({
        id: 't',
        bucket_kind: 'topup',
        remaining_credits: 50,
        reserved_credits: 0,
      });
      expect(aggregateTopupCreditsAvailable([g], now, false)).toBe(0);
      expect(aggregateTopupCreditsAvailable([g], now, true)).toBe(50);
    });

    it('aggregateReservedCredits counts recurring only while cycle is open', () => {
      const closed = grant({
        id: 'c',
        bucket_kind: 'recurring_free',
        cycle_end: '2025-06-01T00:00:00.000Z',
        reserved_credits: 9,
      });
      const open = grant({
        id: 'o',
        bucket_kind: 'recurring_free',
        cycle_end: cycleEndFuture,
        reserved_credits: 3,
      });
      expect(aggregateReservedCredits([closed, open], now)).toBe(3);
    });
  });

  describe('sortBucketsForDisplay', () => {
    it('orders recurring by earlier cycle_end first, then topup, then manual', () => {
      const rLate = grant({
        id: 'r2',
        bucket_kind: 'recurring_paid',
        cycle_end: '2025-09-01T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
      });
      const rEarly = grant({
        id: 'r1',
        bucket_kind: 'recurring_free',
        cycle_end: '2025-08-01T00:00:00.000Z',
        created_at: '2025-01-02T00:00:00.000Z',
      });
      const t = grant({
        id: 't1',
        bucket_kind: 'topup',
        created_at: '2025-02-01T00:00:00.000Z',
      });
      const m = grant({
        id: 'm1',
        bucket_kind: 'manual',
        created_at: '2025-03-01T00:00:00.000Z',
      });
      const sorted = sortBucketsForDisplay([m, t, rLate, rEarly]);
      expect(sorted.map((g) => g.id)).toEqual(['r1', 'r2', 't1', 'm1']);
    });
  });
});
