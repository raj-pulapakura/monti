-- Runtime credit enforcement: one active reservation per tool invocation; reserve / release / settle RPCs.

create unique index if not exists idx_credit_reservations_active_tool_invocation_unique
  on public.credit_reservations (tool_invocation_id)
  where status = 'active' and tool_invocation_id is not null;

create or replace function public.billing_reserve_generation_credits(
  p_user_id uuid,
  p_tool_invocation_id uuid,
  p_credits int,
  p_pricing_rule_snapshot_id uuid,
  p_now timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_grant_id uuid;
  v_paid_active boolean;
  v_reservation_id uuid;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'billing_reserve_generation_credits: p_credits must be positive';
  end if;

  select cr.id
  into v_existing
  from public.credit_reservations cr
  where cr.tool_invocation_id = p_tool_invocation_id
    and cr.status = 'active'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select exists (
    select 1
    from public.billing_subscriptions bs
    where bs.user_id = p_user_id
      and bs.current_period_end is not null
      and bs.current_period_end > p_now
  )
  into v_paid_active;

  select cg.id
  into v_grant_id
  from public.credit_grants cg
  where cg.user_id = p_user_id
    and cg.remaining_credits - cg.reserved_credits >= p_credits
    and (
      (cg.bucket_kind = 'recurring_free'
        and (cg.cycle_end is null or cg.cycle_end > p_now))
      or
      (cg.bucket_kind = 'recurring_paid'
        and v_paid_active
        and (cg.cycle_end is null or cg.cycle_end > p_now))
      or
      (cg.bucket_kind = 'topup' and v_paid_active)
      or
      (cg.bucket_kind = 'manual'
        and (cg.cycle_end is null or cg.cycle_end > p_now))
    )
  order by
    case cg.bucket_kind
      when 'recurring_free' then 0
      when 'recurring_paid' then 0
      when 'topup' then 1
      when 'manual' then 2
      else 3
    end,
    cg.cycle_end asc nulls last,
    cg.created_at asc
  for update of cg
  limit 1;

  if v_grant_id is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.credit_grants cg
  set reserved_credits = cg.reserved_credits + p_credits
  where cg.id = v_grant_id
    and cg.remaining_credits - cg.reserved_credits >= p_credits;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_reservations (
    user_id,
    status,
    credits_reserved,
    credit_grant_id,
    tool_invocation_id
  )
  values (
    p_user_id,
    'active',
    p_credits,
    v_grant_id,
    p_tool_invocation_id
  )
  returning id into v_reservation_id;

  insert into public.credit_ledger_entries (
    user_id,
    entry_type,
    credits_delta,
    pricing_rule_snapshot_id,
    credit_grant_id,
    credit_reservation_id,
    metadata
  )
  values (
    p_user_id,
    'reservation_created',
    0,
    p_pricing_rule_snapshot_id,
    v_grant_id,
    v_reservation_id,
    jsonb_build_object('credits_reserved', p_credits)
  );

  return v_reservation_id;
end;
$$;

create or replace function public.billing_release_generation_reservation(
  p_reservation_id uuid,
  p_pricing_rule_snapshot_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_grant_id uuid;
  v_credits int;
begin
  select cr.user_id, cr.credit_grant_id, cr.credits_reserved
  into v_user_id, v_grant_id, v_credits
  from public.credit_reservations cr
  where cr.id = p_reservation_id
    and cr.status = 'active'
  for update;

  if not found then
    return;
  end if;

  update public.credit_reservations cr
  set status = 'released', updated_at = now()
  where cr.id = p_reservation_id;

  update public.credit_grants cg
  set reserved_credits = cg.reserved_credits - v_credits
  where cg.id = v_grant_id
    and cg.reserved_credits >= v_credits;

  insert into public.credit_ledger_entries (
    user_id,
    entry_type,
    credits_delta,
    pricing_rule_snapshot_id,
    credit_grant_id,
    credit_reservation_id,
    metadata
  )
  values (
    v_user_id,
    'reservation_released',
    0,
    p_pricing_rule_snapshot_id,
    v_grant_id,
    p_reservation_id,
    jsonb_build_object('credits_reserved', v_credits)
  );
end;
$$;

create or replace function public.billing_settle_generation_reservation(
  p_reservation_id uuid,
  p_pricing_rule_snapshot_id uuid,
  p_experience_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_grant_id uuid;
  v_credits int;
begin
  select cr.user_id, cr.credit_grant_id, cr.credits_reserved
  into v_user_id, v_grant_id, v_credits
  from public.credit_reservations cr
  where cr.id = p_reservation_id
    and cr.status = 'active'
  for update;

  if not found then
    raise exception 'billing_settle_generation_reservation: reservation not active or missing';
  end if;

  update public.credit_grants cg
  set
    remaining_credits = cg.remaining_credits - v_credits,
    reserved_credits = cg.reserved_credits - v_credits
  where cg.id = v_grant_id
    and cg.reserved_credits >= v_credits
    and cg.remaining_credits >= v_credits;

  if not found then
    raise exception 'billing_settle_generation_reservation: grant invariant violated';
  end if;

  update public.credit_reservations cr
  set status = 'settled', updated_at = now()
  where cr.id = p_reservation_id;

  insert into public.credit_ledger_entries (
    user_id,
    entry_type,
    credits_delta,
    pricing_rule_snapshot_id,
    credit_grant_id,
    credit_reservation_id,
    metadata
  )
  values (
    v_user_id,
    'debit_settled',
    -v_credits,
    p_pricing_rule_snapshot_id,
    v_grant_id,
    p_reservation_id,
    jsonb_build_object(
      'experience_version_id', p_experience_version_id
    )
  );
end;
$$;

revoke all on function public.billing_reserve_generation_credits(uuid, uuid, int, uuid, timestamptz) from public;
grant execute on function public.billing_reserve_generation_credits(uuid, uuid, int, uuid, timestamptz) to service_role;

revoke all on function public.billing_release_generation_reservation(uuid, uuid) from public;
grant execute on function public.billing_release_generation_reservation(uuid, uuid) to service_role;

revoke all on function public.billing_settle_generation_reservation(uuid, uuid, uuid) from public;
grant execute on function public.billing_settle_generation_reservation(uuid, uuid, uuid) to service_role;
