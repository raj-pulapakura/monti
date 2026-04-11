import { Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { resolvePricingFromSnapshot } from './billing-pricing';
import type { BillingMeBucketDto, BillingMeDataDto } from './billing-me.types';
import {
  aggregateIncludedCreditsAvailable,
  aggregateReservedCredits,
  aggregateTopupCreditsAvailable,
  aggregateTotalSpendableCredits,
  isPaidEntitlementActive,
  paidPeriodEndsAtIso,
  sortBucketsForDisplay,
  spendableOnGrant,
  utcCalendarMonthRangeUtcMs,
  nextUtcMonthStartMs,
  type GrantRowLike,
} from './entitlement-math';
import type { Database } from '../supabase/supabase.types';

type CreditGrantRow = Database['public']['Tables']['credit_grants']['Row'];

@Injectable()
export class EntitlementService {
  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly billingRepository: BillingRepository,
  ) {}

  async getBillingMe(userId: string): Promise<BillingMeDataDto> {
    const cfg = this.billingConfig;

    if (!cfg.billingEnabled) {
      return this.disabledPayload();
    }

    const nowMs = Date.now();
    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      cfg.launchPricingVersionKey,
    );
    const pricing = resolvePricingFromSnapshot(snapshot?.rules_json ?? null, cfg.launchCatalog);
    const versionKey = snapshot?.version_key ?? cfg.launchPricingVersionKey;

    const subscriptions = await this.billingRepository.listBillingSubscriptionsByUserId(userId);
    const paidActive = isPaidEntitlementActive(subscriptions, nowMs);
    const plan = paidActive ? 'paid' : 'free';
    const paidEnds = paidPeriodEndsAtIso(subscriptions, nowMs);

    if (cfg.freeCreditGrantsEnabled && plan === 'free') {
      if (!snapshot) {
        throw new AppError(
          'INTERNAL_ERROR',
          `Pricing rule snapshot "${cfg.launchPricingVersionKey}" is missing; cannot issue free grants.`,
          500,
        );
      }
      const { startMs, endMs } = utcCalendarMonthRangeUtcMs(nowMs);
      const cycleStartIso = new Date(startMs).toISOString();
      const cycleEndIso = new Date(endMs).toISOString();

      await this.billingRepository.ensureFreeMonthlyGrantWithLedger({
        userId,
        pricingRuleSnapshotId: snapshot.id,
        amount: pricing.freeMonthlyCredits,
        cycleStartIso,
        cycleEndIso,
      });
    }

    const grantRows = await this.billingRepository.listCreditGrantsByUserId(userId);
    const grants = grantRows.map((row) => this.toGrantLike(row));
    const grantedById = new Map(grantRows.map((r) => [r.id, r.granted_credits]));

    const included = aggregateIncludedCreditsAvailable(grants, nowMs, paidActive);
    const topup = aggregateTopupCreditsAvailable(grants, nowMs, paidActive);
    const reservedTotal = aggregateReservedCredits(grants, nowMs);

    const sorted = sortBucketsForDisplay(grants);
    const buckets: BillingMeBucketDto[] = sorted.map((g) => ({
      id: g.id,
      bucketKind: g.bucket_kind,
      source: g.source,
      spendableCredits: spendableOnGrant(g),
      reservedCredits: g.reserved_credits,
      grantedCredits: grantedById.get(g.id) ?? 0,
      cycleStart: g.cycle_start,
      cycleEnd: g.cycle_end,
      createdAt: g.created_at,
    }));

    return {
      billingEnabled: true,
      freeCreditGrantsEnabled: cfg.freeCreditGrantsEnabled,
      plan,
      pricingRuleVersionKey: versionKey,
      costs: {
        fastCredits: pricing.fastCredits,
        qualityCredits: pricing.qualityCredits,
      },
      includedCreditsAvailable: included,
      topupCreditsAvailable: topup,
      reservedCreditsTotal: reservedTotal,
      buckets,
      nextIncludedRefreshAt: new Date(nextUtcMonthStartMs(nowMs)).toISOString(),
      paidPeriodEndsAt: paidEnds,
    };
  }

  /**
   * Read-only spendable balance for credit pre-checks. Both fields mirror the same fungible pool
   * (compare totals against fast vs quality costs separately). Returns null on fetch error (fail-open).
   */
  async readSpendableBalance(userId: string): Promise<{ fast: number; quality: number } | null> {
    try {
      if (!this.billingConfig.billingEnabled) {
        return { fast: 0, quality: 0 };
      }

      const nowMs = Date.now();
      const subscriptions = await this.billingRepository.listBillingSubscriptionsByUserId(userId);
      const paidActive = isPaidEntitlementActive(subscriptions, nowMs);
      const grantRows = await this.billingRepository.listCreditGrantsByUserId(userId);
      const grants = grantRows.map((row) => this.toGrantLike(row));
      const total = aggregateTotalSpendableCredits(grants, nowMs, paidActive);
      return { fast: total, quality: total };
    } catch {
      return null;
    }
  }

  private disabledPayload(): BillingMeDataDto {
    return {
      billingEnabled: false,
      freeCreditGrantsEnabled: false,
      plan: 'free',
      pricingRuleVersionKey: null,
      costs: { fastCredits: null, qualityCredits: null },
      includedCreditsAvailable: null,
      topupCreditsAvailable: null,
      reservedCreditsTotal: null,
      buckets: [],
      nextIncludedRefreshAt: null,
      paidPeriodEndsAt: null,
    };
  }

  private toGrantLike(row: CreditGrantRow): GrantRowLike {
    return {
      id: row.id,
      bucket_kind: row.bucket_kind,
      source: row.source,
      cycle_start: row.cycle_start,
      cycle_end: row.cycle_end,
      remaining_credits: row.remaining_credits,
      reserved_credits: row.reserved_credits,
      created_at: row.created_at,
    };
  }
}
