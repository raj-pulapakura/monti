import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../supabase/supabase.types';

type BillingCustomerRow = Database['public']['Tables']['billing_customers']['Row'];
type BillingCustomerInsert = Database['public']['Tables']['billing_customers']['Insert'];
type PricingRuleSnapshotRow = Database['public']['Tables']['pricing_rule_snapshots']['Row'];
type CreditGrantRow = Database['public']['Tables']['credit_grants']['Row'];
type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];
type BillingCheckoutSessionInsert = Database['public']['Tables']['billing_checkout_sessions']['Insert'];
type BillingWebhookEventInsert = Database['public']['Tables']['billing_webhook_events']['Insert'];
type CreditGrantInsert = Database['public']['Tables']['credit_grants']['Insert'];
type CreditGrantUpdate = Database['public']['Tables']['credit_grants']['Update'];
type CreditLedgerInsert = Database['public']['Tables']['credit_ledger_entries']['Insert'];
type CreditLedgerRow = Database['public']['Tables']['credit_ledger_entries']['Row'];
type BillingWebhookEventRow = Database['public']['Tables']['billing_webhook_events']['Row'];
type ExperienceVersionRow = Database['public']['Tables']['experience_versions']['Row'];

export type ReconciliationSummaryRow = {
  month: string;
  quality_tier: 'fast' | 'quality' | 'unknown';
  credits_debited: number;
  request_tokens_in: number;
  request_tokens_out: number;
  total_tokens: number;
  rows_included: number;
};

function isUniqueViolation(error: { code?: string | null }): boolean {
  return error.code === '23505';
}

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

  async findPricingRuleSnapshotById(id: string): Promise<PricingRuleSnapshotRow | null> {
    const { data, error } = await this.admin
      .from('pricing_rule_snapshots')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.throwQueryError('find pricing rule snapshot by id', error);
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

  async findMostSpendableGrantByUserId(userId: string): Promise<CreditGrantRow | null> {
    const { data, error } = await this.admin
      .from('credit_grants')
      .select('*')
      .eq('user_id', userId)
      .gt('remaining_credits', 0)
      .order('cycle_end', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find most spendable credit grant by user id', error);
    }

    return data;
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

  async ensureBillingCustomerRow(userId: string): Promise<BillingCustomerRow> {
    const existing = await this.findBillingCustomerByUserId(userId);
    if (existing) {
      return existing;
    }

    const { error } = await this.admin.from('billing_customers').insert({ user_id: userId });

    if (error && !isUniqueViolation(error)) {
      this.throwQueryError('insert billing customer row', error);
    }

    if (error && isUniqueViolation(error)) {
      const retry = await this.findBillingCustomerByUserId(userId);
      if (retry) {
        return retry;
      }
    }

    const created = await this.findBillingCustomerByUserId(userId);
    if (!created) {
      throw new AppError('INTERNAL_ERROR', 'Expected billing customer row after insert.', 500);
    }
    return created;
  }

  async upsertBillingCustomerStripeId(userId: string, stripeCustomerId: string): Promise<void> {
    await this.ensureBillingCustomerRow(userId);
    await this.updateBillingCustomerStripeId(userId, stripeCustomerId);
  }

  async updateBillingCustomerStripeId(userId: string, stripeCustomerId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.admin
      .from('billing_customers')
      .update({ stripe_customer_id: stripeCustomerId, updated_at: now })
      .eq('user_id', userId);

    if (error) {
      this.throwQueryError('update billing customer stripe id', error);
    }
  }

  async findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
    const { data, error } = await this.admin
      .from('billing_customers')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find user id by stripe customer id', error);
    }

    return data?.user_id ?? null;
  }

  async insertBillingCheckoutSession(input: BillingCheckoutSessionInsert): Promise<void> {
    const { error } = await this.admin.from('billing_checkout_sessions').insert(input);
    if (error) {
      this.throwQueryError('insert billing checkout session', error);
    }
  }

  /**
   * Inserts a webhook row in `received` state. Returns false if `stripe_event_id` already exists (idempotent no-op).
   */
  async tryInsertWebhookEventReceived(input: {
    stripeEventId: string;
    eventType: string;
    payload: Record<string, unknown> | null;
  }): Promise<boolean> {
    const row: BillingWebhookEventInsert = {
      stripe_event_id: input.stripeEventId,
      event_type: input.eventType,
      payload: input.payload,
      processing_status: 'received',
    };

    const { error } = await this.admin.from('billing_webhook_events').insert(row);

    if (error && isUniqueViolation(error)) {
      return false;
    }

    if (error) {
      this.throwQueryError('insert billing webhook event', error);
    }

    return true;
  }

  async updateWebhookEventByStripeEventId(
    stripeEventId: string,
    patch: {
      processing_status: 'received' | 'processing' | 'processed' | 'failed';
      error_message?: string | null;
      processed_at?: string | null;
    },
  ): Promise<void> {
    const { error } = await this.admin
      .from('billing_webhook_events')
      .update(patch)
      .eq('stripe_event_id', stripeEventId);

    if (error) {
      this.throwQueryError('update billing webhook event', error);
    }
  }

  async findWebhookEventById(id: string): Promise<BillingWebhookEventRow | null> {
    const { data, error } = await this.admin
      .from('billing_webhook_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find webhook event by id', error);
    }

    return data;
  }

  async resetWebhookEventStatus(id: string): Promise<void> {
    const { error } = await this.admin
      .from('billing_webhook_events')
      .update({ processing_status: 'received', error_message: null, processed_at: null })
      .eq('id', id);

    if (error) {
      this.throwQueryError('reset webhook event status', error);
    }
  }

  async upsertBillingSubscription(input: {
    userId: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodStartIso: string | null;
    currentPeriodEndIso: string | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<void> {
    const now = new Date().toISOString();
    const row = {
      user_id: input.userId,
      stripe_subscription_id: input.stripeSubscriptionId,
      status: input.status,
      current_period_start: input.currentPeriodStartIso,
      current_period_end: input.currentPeriodEndIso,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      updated_at: now,
    };

    const { error } = await this.admin.from('billing_subscriptions').upsert(row, {
      onConflict: 'stripe_subscription_id',
    });

    if (error) {
      this.throwQueryError('upsert billing subscription', error);
    }
  }

  async findCreditGrantByStripeInvoiceId(stripeInvoiceId: string): Promise<CreditGrantRow | null> {
    const { data, error } = await this.admin
      .from('credit_grants')
      .select('*')
      .eq('stripe_invoice_id', stripeInvoiceId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find credit grant by stripe invoice id', error);
    }

    return data;
  }

  async findCreditGrantByStripeCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<CreditGrantRow | null> {
    const { data, error } = await this.admin
      .from('credit_grants')
      .select('*')
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find credit grant by stripe checkout session id', error);
    }

    return data;
  }

  async insertPaidRecurringGrantWithLedger(input: {
    userId: string;
    pricingRuleSnapshotId: string;
    grantedCredits: number;
    cycleStartIso: string | null;
    cycleEndIso: string | null;
    stripeInvoiceId: string | null;
    stripeCheckoutSessionId: string | null;
    stripeEventId: string;
  }): Promise<void> {
    const grantRow: CreditGrantInsert = {
      user_id: input.userId,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      source: 'paid_cycle',
      bucket_kind: 'recurring_paid',
      granted_credits: input.grantedCredits,
      remaining_credits: input.grantedCredits,
      reserved_credits: 0,
      cycle_start: input.cycleStartIso,
      cycle_end: input.cycleEndIso,
      stripe_invoice_id: input.stripeInvoiceId,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
    };

    const { data: grant, error: grantError } = await this.admin
      .from('credit_grants')
      .insert(grantRow)
      .select('id')
      .single();

    if (grantError) {
      this.throwQueryError('insert paid recurring credit grant', grantError);
    }

    if (!grant) {
      throw new AppError('INTERNAL_ERROR', 'Inserted paid grant was not returned.', 500);
    }

    const ledgerRow: CreditLedgerInsert = {
      user_id: input.userId,
      entry_type: 'paid_monthly_grant',
      credits_delta: input.grantedCredits,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      credit_grant_id: grant.id,
      stripe_event_id: input.stripeEventId,
    };

    const { error: ledgerError } = await this.admin.from('credit_ledger_entries').insert(ledgerRow);

    if (ledgerError) {
      this.throwQueryError('insert paid monthly grant ledger entry', ledgerError);
    }
  }

  async insertTopupGrantWithLedger(input: {
    userId: string;
    pricingRuleSnapshotId: string;
    grantedCredits: number;
    stripeCheckoutSessionId: string;
    stripeEventId: string;
  }): Promise<void> {
    const grantRow: CreditGrantInsert = {
      user_id: input.userId,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      source: 'topup',
      bucket_kind: 'topup',
      granted_credits: input.grantedCredits,
      remaining_credits: input.grantedCredits,
      reserved_credits: 0,
      cycle_start: null,
      cycle_end: null,
      stripe_invoice_id: null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
    };

    const { data: grant, error: grantError } = await this.admin
      .from('credit_grants')
      .insert(grantRow)
      .select('id')
      .single();

    if (grantError) {
      this.throwQueryError('insert topup credit grant', grantError);
    }

    if (!grant) {
      throw new AppError('INTERNAL_ERROR', 'Inserted topup grant was not returned.', 500);
    }

    const ledgerRow: CreditLedgerInsert = {
      user_id: input.userId,
      entry_type: 'topup_grant',
      credits_delta: input.grantedCredits,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      credit_grant_id: grant.id,
      stripe_event_id: input.stripeEventId,
    };

    const { error: ledgerError } = await this.admin.from('credit_ledger_entries').insert(ledgerRow);

    if (ledgerError) {
      this.throwQueryError('insert topup grant ledger entry', ledgerError);
    }
  }

  async insertManualGrantWithLedger(input: {
    userId: string;
    pricingRuleSnapshotId: string;
    credits: number;
    reason: string;
    operatorNote?: string;
  }): Promise<string> {
    const grantRow: CreditGrantInsert = {
      user_id: input.userId,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      source: 'manual',
      bucket_kind: 'manual',
      granted_credits: input.credits,
      remaining_credits: input.credits,
      reserved_credits: 0,
      cycle_start: null,
      cycle_end: null,
      stripe_invoice_id: null,
      stripe_checkout_session_id: null,
    };

    const { data: grant, error: grantError } = await this.admin
      .from('credit_grants')
      .insert(grantRow)
      .select('id')
      .single();
    if (grantError) {
      this.throwQueryError('insert manual credit grant', grantError);
    }
    if (!grant) {
      throw new AppError('INTERNAL_ERROR', 'Inserted manual grant was not returned.', 500);
    }

    const ledgerRow: CreditLedgerInsert = {
      user_id: input.userId,
      entry_type: 'manual_grant',
      credits_delta: input.credits,
      pricing_rule_snapshot_id: input.pricingRuleSnapshotId,
      credit_grant_id: grant.id,
      metadata: { reason: input.reason, operatorNote: input.operatorNote ?? null },
    };

    const { error: ledgerError } = await this.admin.from('credit_ledger_entries').insert(ledgerRow);
    if (ledgerError) {
      this.throwQueryError('insert manual grant ledger entry', ledgerError);
    }

    return grant.id;
  }

  async applyManualReversalToGrant(input: { grantId: string; credits: number }): Promise<void> {
    const grant = await this.findCreditGrantById(input.grantId);
    if (!grant) {
      throw new AppError('VALIDATION_ERROR', 'No eligible credit grant found for reversal.', 400);
    }
    if (grant.remaining_credits < input.credits) {
      throw new AppError('VALIDATION_ERROR', 'Insufficient credits available for reversal.', 400);
    }
    const patch: CreditGrantUpdate = {
      remaining_credits: grant.remaining_credits - input.credits,
    };
    const { error } = await this.admin.from('credit_grants').update(patch).eq('id', input.grantId);
    if (error) {
      this.throwQueryError('apply manual reversal to credit grant', error);
    }
  }

  async insertManualAdjustmentLedgerEntry(input: {
    userId: string;
    grantId: string;
    credits: number;
    reason: string;
    operatorNote?: string;
  }): Promise<void> {
    const ledgerRow: CreditLedgerInsert = {
      user_id: input.userId,
      entry_type: 'manual_adjustment',
      credits_delta: -Math.abs(input.credits),
      credit_grant_id: input.grantId,
      metadata: { reason: input.reason, operatorNote: input.operatorNote ?? null },
    };
    const { error } = await this.admin.from('credit_ledger_entries').insert(ledgerRow);
    if (error) {
      this.throwQueryError('insert manual adjustment ledger entry', error);
    }
  }

  async listLedgerEntriesByUserId(userId: string, limit = 50): Promise<CreditLedgerRow[]> {
    const { data, error } = await this.admin
      .from('credit_ledger_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      this.throwQueryError('list ledger entries by user id', error);
    }
    return data ?? [];
  }

  async listReconciliationSummary(): Promise<ReconciliationSummaryRow[]> {
    const { data, error } = await this.admin
      .from('billing_reconciliation_summary')
      .select('*')
      .order('month', { ascending: false })
      .order('quality_tier', { ascending: true });
    if (error) {
      this.throwQueryError('list reconciliation summary', error);
    }
    return (data ?? []) as ReconciliationSummaryRow[];
  }

  async findExperienceVersionById(id: string): Promise<ExperienceVersionRow | null> {
    const { data, error } = await this.admin.from('experience_versions').select('*').eq('id', id).maybeSingle();
    if (error) {
      this.throwQueryError('find experience version by id', error);
    }
    return data;
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

  private async findCreditGrantById(id: string): Promise<CreditGrantRow | null> {
    const { data, error } = await this.admin.from('credit_grants').select('*').eq('id', id).maybeSingle();
    if (error) {
      this.throwQueryError('find credit grant by id', error);
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
