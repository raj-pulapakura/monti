import { Inject, Injectable } from '@nestjs/common';
import { AppError, InsufficientCreditsError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../supabase/supabase.types';
import { BillingConfigService } from './billing-config.service';
import { BillingRepository } from './billing.repository';
import { creditsForQualityTier, resolvePricingFromSnapshot } from './billing-pricing';

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
  }): Promise<{ reservationId: string; pricingRuleSnapshotId: string }> {
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

    if (data == null || data === '') {
      throw new AppError('INTERNAL_ERROR', 'Reserve credits RPC returned no reservation id.', 500);
    }

    return { reservationId: data, pricingRuleSnapshotId: snapshot.id };
  }

  async releaseReservation(input: { reservationId: string; pricingRuleSnapshotId: string }): Promise<void> {
    const { error } = await this.admin.rpc('billing_release_generation_reservation', {
      p_reservation_id: input.reservationId,
      p_pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
    });

    if (error) {
      this.throwRpcError('release generation reservation', error);
    }
  }

  async settleReservation(input: {
    reservationId: string;
    pricingRuleSnapshotId: string;
    experienceVersionId: string | null;
  }): Promise<void> {
    const { error } = await this.admin.rpc('billing_settle_generation_reservation', {
      p_reservation_id: input.reservationId,
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
