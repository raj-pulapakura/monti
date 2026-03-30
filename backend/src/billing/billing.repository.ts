import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../supabase/supabase.types';

type BillingCustomerRow = Database['public']['Tables']['billing_customers']['Row'];
type BillingCustomerInsert = Database['public']['Tables']['billing_customers']['Insert'];
type PricingRuleSnapshotRow = Database['public']['Tables']['pricing_rule_snapshots']['Row'];

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
