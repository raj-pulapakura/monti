-- Declarative billing schema. File name sorts after experiences.sql so public._set_updated_at exists.
-- Mirrors supabase/migrations/20260331000100_add_billing_domain_foundation.sql.

create table if not exists public.pricing_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  rules_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  mode text not null check (mode in ('subscription', 'payment')),
  intent text not null check (intent in ('subscription', 'topup')),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processing', 'processed', 'failed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pricing_rule_snapshot_id uuid not null references public.pricing_rule_snapshots (id),
  source text not null check (
    source in ('free_cycle', 'paid_cycle', 'topup', 'manual', 'promo')
  ),
  bucket_kind text not null check (
    bucket_kind in ('recurring_free', 'recurring_paid', 'topup', 'manual')
  ),
  granted_credits int not null check (granted_credits > 0),
  remaining_credits int not null check (remaining_credits >= 0),
  reserved_credits int not null default 0 check (reserved_credits >= 0),
  cycle_start timestamptz,
  cycle_end timestamptz,
  stripe_invoice_id text,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  check (remaining_credits + reserved_credits <= granted_credits)
);

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'released', 'settled')),
  credits_reserved int not null check (credits_reserved > 0),
  credit_grant_id uuid references public.credit_grants (id) on delete set null,
  tool_invocation_id uuid references public.tool_invocations (id) on delete set null,
  generation_run_id uuid references public.generation_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null check (
    entry_type in (
      'free_monthly_grant',
      'paid_monthly_grant',
      'topup_grant',
      'manual_grant',
      'reservation_created',
      'reservation_released',
      'debit_settled',
      'manual_adjustment',
      'expiration'
    )
  ),
  credits_delta int not null,
  pricing_rule_snapshot_id uuid references public.pricing_rule_snapshots (id),
  credit_grant_id uuid references public.credit_grants (id),
  credit_reservation_id uuid references public.credit_reservations (id),
  stripe_event_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public._credit_ledger_entries_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'credit_ledger_entries rows are append-only';
end;
$$;

drop trigger if exists trg_credit_ledger_entries_prevent_update on public.credit_ledger_entries;
create trigger trg_credit_ledger_entries_prevent_update
before update on public.credit_ledger_entries
for each row execute function public._credit_ledger_entries_prevent_mutation();

drop trigger if exists trg_credit_ledger_entries_prevent_delete on public.credit_ledger_entries;
create trigger trg_credit_ledger_entries_prevent_delete
before delete on public.credit_ledger_entries
for each row execute function public._credit_ledger_entries_prevent_mutation();

drop trigger if exists trg_billing_customers_updated_at on public.billing_customers;
create trigger trg_billing_customers_updated_at
before update on public.billing_customers
for each row execute function public._set_updated_at();

drop trigger if exists trg_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger trg_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute function public._set_updated_at();

drop trigger if exists trg_credit_reservations_updated_at on public.credit_reservations;
create trigger trg_credit_reservations_updated_at
before update on public.credit_reservations
for each row execute function public._set_updated_at();

create index if not exists idx_billing_subscriptions_user_id on public.billing_subscriptions (user_id);
create index if not exists idx_billing_checkout_sessions_user_id on public.billing_checkout_sessions (user_id);
create index if not exists idx_billing_webhook_events_processing_status_created_at
  on public.billing_webhook_events (processing_status, created_at desc);
create index if not exists idx_credit_grants_user_id on public.credit_grants (user_id);
create index if not exists idx_credit_grants_pricing_rule_snapshot_id on public.credit_grants (pricing_rule_snapshot_id);
create unique index if not exists idx_credit_grants_recurring_free_user_cycle
  on public.credit_grants (user_id, cycle_start)
  where bucket_kind = 'recurring_free';
create index if not exists idx_credit_reservations_user_id_status on public.credit_reservations (user_id, status);
create index if not exists idx_credit_reservations_tool_invocation_id on public.credit_reservations (tool_invocation_id);
create unique index if not exists idx_credit_reservations_active_tool_invocation_grant_unique
  on public.credit_reservations (tool_invocation_id, credit_grant_id)
  where status = 'active'
    and tool_invocation_id is not null
    and credit_grant_id is not null;
create index if not exists idx_credit_reservations_generation_run_id on public.credit_reservations (generation_run_id);
create index if not exists idx_credit_ledger_entries_user_id_created_at on public.credit_ledger_entries (user_id, created_at desc);
create index if not exists idx_credit_ledger_entries_entry_type on public.credit_ledger_entries (entry_type);

alter table public.pricing_rule_snapshots enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_ledger_entries enable row level security;

alter table public.pricing_rule_snapshots force row level security;
alter table public.billing_customers force row level security;
alter table public.billing_subscriptions force row level security;
alter table public.billing_checkout_sessions force row level security;
alter table public.billing_webhook_events force row level security;
alter table public.credit_grants force row level security;
alter table public.credit_reservations force row level security;
alter table public.credit_ledger_entries force row level security;

drop policy if exists pricing_rule_snapshots_authenticated_select on public.pricing_rule_snapshots;
create policy pricing_rule_snapshots_authenticated_select on public.pricing_rule_snapshots
for select
to authenticated
using (true);

drop policy if exists billing_customers_owner_select on public.billing_customers;
create policy billing_customers_owner_select on public.billing_customers
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists billing_subscriptions_owner_select on public.billing_subscriptions;
create policy billing_subscriptions_owner_select on public.billing_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists billing_checkout_sessions_owner_select on public.billing_checkout_sessions;
create policy billing_checkout_sessions_owner_select on public.billing_checkout_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists credit_grants_owner_select on public.credit_grants;
create policy credit_grants_owner_select on public.credit_grants
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists credit_reservations_owner_select on public.credit_reservations;
create policy credit_reservations_owner_select on public.credit_reservations
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists credit_ledger_entries_owner_select on public.credit_ledger_entries;
create policy credit_ledger_entries_owner_select on public.credit_ledger_entries
for select
to authenticated
using (user_id = (select auth.uid()));

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

insert into public.pricing_rule_snapshots (version_key, rules_json)
values (
  'launch-v1',
  jsonb_build_object(
    'freeMonthlyCredits', 15,
    'paidMonthlyCredits', 150,
    'fastCredits', 1,
    'qualityCredits', 5,
    'topupCredits', 300,
    'topupPriceUsd', 4,
    'paidPlanPriceUsd', 10
  )
)
on conflict (version_key) do nothing;

insert into public.pricing_rule_snapshots (version_key, rules_json)
values (
  'launch-v2',
  jsonb_build_object(
    'freeMonthlyCredits', 200,
    'paidMonthlyCredits', 1000,
    'fastCredits', 1,
    'qualityCredits', 5,
    'topupCredits', 300,
    'topupPriceUsd', 4,
    'paidPlanPriceUsd', 10
  )
)
on conflict (version_key) do nothing;
