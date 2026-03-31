import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../supabase/supabase.types';

type BillingCustomerRow = Database['public']['Tables']['billing_customers']['Row'];
type BillingCustomerInsert = Database['public']['Tables']['billing_customers']['Insert'];
type PricingRuleSnapshotRow = Database['public']['Tables']['pricing_rule_snapshots']['Row'];
type CreditGrantRow = Database['public']['Tables']['credit_grants']['Row'];
type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

@Injectable()
export class BillingRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly admin: MontiSupabaseClient,
  ) {}

  async findBillingCustomerByUserId(userId: string): Promise<BillingCustomerRow | null> {
    const { data, error } = await this.admin
      .from('billing_customers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find billing customer by user id', error);
    }

    return data;
  }

  async insertBillingCustomer(input: BillingCustomerInsert): Promise<BillingCustomerRow> {
    const { data, error } = await this.admin
      .from('billing_customers')
      .insert(input)
      .select('*')
      .single();

    if (error) {
      this.throwQueryError('insert billing customer', error);
    }

    if (!data) {
      throw new AppError('INTERNAL_ERROR', 'Inserted billing customer was not returned.', 500);
    }

    return data;
  }

  async findPricingRuleSnapshotByVersionKey(versionKey: string): Promise<PricingRuleSnapshotRow | null> {
    const { data, error } = await this.admin
      .from('pricing_rule_snapshots')
      .select('*')
      .eq('version_key', versionKey)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find pricing rule snapshot by version key', error);
    }

    return data;
  }

  async listCreditGrantsByUserId(userId: string): Promise<CreditGrantRow[]> {
    const { data, error } = await this.admin
      .from('credit_grants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.throwQueryError('list credit grants by user id', error);
    }

    return data ?? [];
  }

  async listBillingSubscriptionsByUserId(userId: string): Promise<BillingSubscriptionRow[]> {
    const { data, error } = await this.admin
      .from('billing_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      this.throwQueryError('list billing subscriptions by user id', error);
    }

    return data ?? [];
  }

  /**
   * Atomically ensures a recurring_free grant for the UTC month and inserts a ledger row when newly created.
   */
  async ensureFreeMonthlyGrantWithLedger(input: {
    userId: string;
    pricingRuleSnapshotId: string;
    amount: number;
    cycleStartIso: string;
    cycleEndIso: string;
  }): Promise<string> {
    const { data, error } = await this.admin.rpc('billing_ensure_free_monthly_grant_with_ledger', {
      p_user_id: input.userId,
      p_pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      p_amount: input.amount,
      p_cycle_start: input.cycleStartIso,
      p_cycle_end: input.cycleEndIso,
    });

    if (error) {
      this.throwQueryError('ensure free monthly grant with ledger', error);
    }

    if (data == null || data === '') {
      throw new AppError(
        'INTERNAL_ERROR',
        'RPC billing_ensure_free_monthly_grant_with_ledger returned no grant id.',
        500,
      );
    }

    return data;
  }

  private throwQueryError(
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
