-- Idempotent free monthly grants: at most one recurring_free row per user per UTC month start,
-- plus atomic grant + ledger insert for audit.

create unique index if not exists idx_credit_grants_recurring_free_user_cycle
  on public.credit_grants (user_id, cycle_start)
  where bucket_kind = 'recurring_free';

create or replace function public.billing_ensure_free_monthly_grant_with_ledger(
  p_user_id uuid,
  p_pricing_rule_snapshot_id uuid,
  p_amount int,
  p_cycle_start timestamptz,
  p_cycle_end timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.credit_grants (
    user_id,
    pricing_rule_snapshot_id,
    source,
    bucket_kind,
    granted_credits,
    remaining_credits,
    reserved_credits,
    cycle_start,
    cycle_end
  )
  values (
    p_user_id,
    p_pricing_rule_snapshot_id,
    'free_cycle',
    'recurring_free',
    p_amount,
    p_amount,
    0,
    p_cycle_start,
    p_cycle_end
  )
  on conflict (user_id, cycle_start) where (bucket_kind = 'recurring_free')
  do nothing
  returning id into v_id;

  if v_id is null then
    select cg.id
    into v_id
    from public.credit_grants cg
    where cg.user_id = p_user_id
      and cg.bucket_kind = 'recurring_free'
      and cg.cycle_start = p_cycle_start
    limit 1;
  else
    insert into public.credit_ledger_entries (
      user_id,
      entry_type,
      credits_delta,
      pricing_rule_snapshot_id,
      credit_grant_id
    )
    values (
      p_user_id,
      'free_monthly_grant',
      p_amount,
      p_pricing_rule_snapshot_id,
      v_id
    );
  end if;

  if v_id is null then
    raise exception 'billing_ensure_free_monthly_grant_with_ledger: grant missing after upsert';
  end if;

  return v_id;
end;
$$;

revoke all on function public.billing_ensure_free_monthly_grant_with_ledger(uuid, uuid, int, timestamptz, timestamptz) from public;
grant execute on function public.billing_ensure_free_monthly_grant_with_ledger(uuid, uuid, int, timestamptz, timestamptz) to service_role;
