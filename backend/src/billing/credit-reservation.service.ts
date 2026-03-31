import { Inject, Injectable } from '@nestjs/common';
import { AppError, InsufficientCreditsError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../supabase/supabase.types';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { creditsForQualityTier, resolvePricingFromSnapshot } from './billing-pricing';

export type CreditReservationSlice = {
  reservationId: string;
  creditGrantId: string;
  creditsReserved: number;
};

@Injectable()
export class CreditReservationService {
  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly billingRepository: BillingRepository,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly admin: MontiSupabaseClient,
  ) {}

  /** Hard gate: both billing and credit enforcement must be on. */
  shouldEnforceReservation(): boolean {
    return this.billingConfig.billingEnabled && this.billingConfig.creditEnforcementEnabled;
  }

  async reserveForToolInvocation(input: {
    userId: string;
    toolInvocationId: string;
    qualityTier: 'fast' | 'quality';
  }): Promise<{ slices: CreditReservationSlice[]; pricingRuleSnapshotId: string }> {
    const snapshot = await this.billingRepository.findPricingRuleSnapshotByVersionKey(
      this.billingConfig.launchPricingVersionKey,
    );
    if (!snapshot) {
      throw new AppError(
        'INTERNAL_ERROR',
        `Pricing rule snapshot "${this.billingConfig.launchPricingVersionKey}" is missing; cannot reserve credits.`,
        500,
      );
    }

    const pricing = resolvePricingFromSnapshot(snapshot.rules_json, this.billingConfig.launchCatalog);
    const credits = creditsForQualityTier(pricing, input.qualityTier);

    const { data, error } = await this.admin.rpc('billing_reserve_generation_credits', {
      p_user_id: input.userId,
      p_tool_invocation_id: input.toolInvocationId,
      p_credits: credits,
      p_pricing_rule_snapshot_id: snapshot.id,
    });

    if (error) {
      if (error.message?.includes('INSUFFICIENT_CREDITS')) {
        throw new InsufficientCreditsError();
      }
      this.throwRpcError('reserve generation credits', error);
    }

    const slices = parseReserveSlicesPayload(data);
    if (slices.length === 0) {
      throw new AppError('INTERNAL_ERROR', 'Reserve credits RPC returned no reservation slices.', 500);
    }

    return { slices, pricingRuleSnapshotId: snapshot.id };
  }

  async releaseReservation(input: {
    userId: string;
    toolInvocationId: string;
    pricingRuleSnapshotId: string;
  }): Promise<void> {
    const { error } = await this.admin.rpc('billing_release_generation_reservation', {
      p_user_id: input.userId,
      p_tool_invocation_id: input.toolInvocationId,
      p_pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
    });

    if (error) {
      this.throwRpcError('release generation reservation', error);
    }
  }

  async settleReservation(input: {
    userId: string;
    toolInvocationId: string;
    pricingRuleSnapshotId: string;
    experienceVersionId: string;
  }): Promise<void> {
    const { error } = await this.admin.rpc('billing_settle_generation_reservation', {
      p_user_id: input.userId,
      p_tool_invocation_id: input.toolInvocationId,
      p_pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      p_experience_version_id: input.experienceVersionId,
    });

    if (error) {
      this.throwRpcError('settle generation reservation', error);
    }
  }

  private throwRpcError(
    action: string,
    error: { message: string; code?: string | null; details?: string | null; hint?: string | null },
  ): never {
    throw new AppError('INTERNAL_ERROR', `Failed to ${action}.`, 500, {
      code: error.code ?? undefined,
      message: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
    });
  }
}

function parseReserveSlicesPayload(data: unknown): CreditReservationSlice[] {
  if (data == null || typeof data !== 'object') {
    return [];
  }
  const raw = data as Record<string, unknown>;
  const slices = raw.slices;
  if (!Array.isArray(slices)) {
    return [];
  }
  const out: CreditReservationSlice[] = [];
  for (const row of slices) {
    if (row == null || typeof row !== 'object') {
      continue;
    }
    const s = row as Record<string, unknown>;
    const reservationId = s.reservation_id;
    const creditGrantId = s.credit_grant_id;
    const creditsReserved = s.credits_reserved;
    if (
      typeof reservationId === 'string' &&
      typeof creditGrantId === 'string' &&
      typeof creditsReserved === 'number' &&
      Number.isFinite(creditsReserved)
    ) {
      out.push({
        reservationId,
        creditGrantId,
        creditsReserved,
      });
    }
  }
  return out;
}
