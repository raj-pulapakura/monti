-- Multi-bucket credit reservations: one active row per (tool_invocation_id, credit_grant_id);
-- reserve allocates across grants; release/settle are scoped by tool_invocation_id + user_id.

drop index if exists public.idx_credit_reservations_active_tool_invocation_unique;

create unique index if not exists idx_credit_reservations_active_tool_invocation_grant_unique
  on public.credit_reservations (tool_invocation_id, credit_grant_id)
  where status = 'active'
    and tool_invocation_id is not null
    and credit_grant_id is not null;

drop function if exists public.billing_reserve_generation_credits(uuid, uuid, int, uuid, timestamptz);
drop function if exists public.billing_release_generation_reservation(uuid, uuid);
drop function if exists public.billing_settle_generation_reservation(uuid, uuid, uuid);

create or replace function public.billing_reserve_generation_credits(
  p_user_id uuid,
  p_tool_invocation_id uuid,
  p_credits int,
  p_pricing_rule_snapshot_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_sum int;
  v_existing_bad_user int;
  v_paid_active boolean;
  v_left int;
  v_take int;
  r record;
  v_reservation_id uuid;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'billing_reserve_generation_credits: p_credits must be positive';
  end if;

  select
    coalesce(sum(cr.credits_reserved), 0)::int,
    count(*) filter (where cr.user_id is distinct from p_user_id)::int
  into v_existing_sum, v_existing_bad_user
  from public.credit_reservations cr
  where cr.tool_invocation_id = p_tool_invocation_id
    and cr.status = 'active';

  if v_existing_bad_user > 0 then
    raise exception 'billing_reserve_generation_credits: tool_invocation_id already reserved for another user';
  end if;

  if v_existing_sum > 0 then
    if v_existing_sum <> p_credits then
      raise exception 'billing_reserve_generation_credits: idempotent reserve credit mismatch';
    end if;

    return (
      select jsonb_build_object(
        'slices',
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'reservation_id', cr.id,
              'credit_grant_id', cr.credit_grant_id,
              'credits_reserved', cr.credits_reserved
            )
            order by cr.created_at, cr.id
          ),
          '[]'::jsonb
        )
      )
      from public.credit_reservations cr
      where cr.tool_invocation_id = p_tool_invocation_id
        and cr.status = 'active'
        and cr.user_id = p_user_id
    );
  end if;

  select exists (
    select 1
    from public.billing_subscriptions bs
    where bs.user_id = p_user_id
      and bs.current_period_end is not null
      and bs.current_period_end > p_now
  )
  into v_paid_active;

  v_left := p_credits;

  for r in
    select
      cg.id as grant_id,
      (cg.remaining_credits - cg.reserved_credits)::int as spendable
    from public.credit_grants cg
    where cg.user_id = p_user_id
      and cg.remaining_credits > cg.reserved_credits
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
  loop
    exit when v_left <= 0;

    v_take := least(r.spendable, v_left);
    if v_take <= 0 then
      continue;
    end if;

    update public.credit_grants cg
    set reserved_credits = cg.reserved_credits + v_take
    where cg.id = r.grant_id
      and cg.remaining_credits - cg.reserved_credits >= v_take;

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
      v_take,
      r.grant_id,
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
      r.grant_id,
      v_reservation_id,
      jsonb_build_object('credits_reserved', v_take)
    );

    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  return (
    select jsonb_build_object(
      'slices',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'reservation_id', cr.id,
            'credit_grant_id', cr.credit_grant_id,
            'credits_reserved', cr.credits_reserved
          )
          order by cr.created_at, cr.id
        ),
        '[]'::jsonb
      )
    )
    from public.credit_reservations cr
    where cr.tool_invocation_id = p_tool_invocation_id
      and cr.status = 'active'
      and cr.user_id = p_user_id
  );
end;
$$;

create or replace function public.billing_release_generation_reservation(
  p_user_id uuid,
  p_tool_invocation_id uuid,
  p_pricing_rule_snapshot_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select cr.id, cr.credit_grant_id, cr.credits_reserved, cr.user_id
    from public.credit_reservations cr
    where cr.tool_invocation_id = p_tool_invocation_id
      and cr.status = 'active'
      and cr.user_id = p_user_id
    order by cr.created_at, cr.id
    for update of cr
  loop
    update public.credit_reservations cr
    set status = 'released', updated_at = now()
    where cr.id = r.id;

    update public.credit_grants cg
    set reserved_credits = cg.reserved_credits - r.credits_reserved
    where cg.id = r.credit_grant_id
      and cg.reserved_credits >= r.credits_reserved;

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
      r.user_id,
      'reservation_released',
      0,
      p_pricing_rule_snapshot_id,
      r.credit_grant_id,
      r.id,
      jsonb_build_object('credits_reserved', r.credits_reserved)
    );
  end loop;
end;
$$;

create or replace function public.billing_settle_generation_reservation(
  p_user_id uuid,
  p_tool_invocation_id uuid,
  p_pricing_rule_snapshot_id uuid,
  p_experience_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select cr.id, cr.credit_grant_id, cr.credits_reserved, cr.user_id
    from public.credit_reservations cr
    where cr.tool_invocation_id = p_tool_invocation_id
      and cr.status = 'active'
      and cr.user_id = p_user_id
    order by cr.created_at, cr.id
    for update of cr
  loop
    update public.credit_grants cg
    set
      remaining_credits = cg.remaining_credits - r.credits_reserved,
      reserved_credits = cg.reserved_credits - r.credits_reserved
    where cg.id = r.credit_grant_id
      and cg.reserved_credits >= r.credits_reserved
      and cg.remaining_credits >= r.credits_reserved;

    if not found then
      raise exception 'billing_settle_generation_reservation: grant invariant violated';
    end if;

    update public.credit_reservations cr
    set status = 'settled', updated_at = now()
    where cr.id = r.id;

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
      r.user_id,
      'debit_settled',
      -r.credits_reserved,
      p_pricing_rule_snapshot_id,
      r.credit_grant_id,
      r.id,
      jsonb_build_object(
        'experience_version_id', p_experience_version_id
      )
    );
  end loop;
end;
$$;

revoke all on function public.billing_reserve_generation_credits(uuid, uuid, int, uuid, timestamptz) from public;
grant execute on function public.billing_reserve_generation_credits(uuid, uuid, int, uuid, timestamptz) to service_role;

revoke all on function public.billing_release_generation_reservation(uuid, uuid, uuid) from public;
grant execute on function public.billing_release_generation_reservation(uuid, uuid, uuid) to service_role;

revoke all on function public.billing_settle_generation_reservation(uuid, uuid, uuid, uuid) from public;
grant execute on function public.billing_settle_generation_reservation(uuid, uuid, uuid, uuid) to service_role;
