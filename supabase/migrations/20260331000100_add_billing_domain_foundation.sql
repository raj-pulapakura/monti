-- Billing domain foundation: persistence, integrity constraints, RLS, launch pricing snapshot seed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.pricing_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  rules_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_subscriptions (
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

create table public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  mode text not null check (mode in ('subscription', 'payment')),
  intent text not null check (intent in ('subscription', 'topup')),
  created_at timestamptz not null default now()
);

create table public.billing_webhook_events (
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

create table public.credit_grants (
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

create table public.credit_reservations (
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

create table public.credit_ledger_entries (
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

-- ---------------------------------------------------------------------------
-- Append-only ledger
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse existing helper when present)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_billing_subscriptions_user_id on public.billing_subscriptions (user_id);
create index idx_billing_checkout_sessions_user_id on public.billing_checkout_sessions (user_id);
create index idx_billing_webhook_events_processing_status_created_at
  on public.billing_webhook_events (processing_status, created_at desc);
create index idx_credit_grants_user_id on public.credit_grants (user_id);
create index idx_credit_grants_pricing_rule_snapshot_id on public.credit_grants (pricing_rule_snapshot_id);
create index idx_credit_reservations_user_id_status on public.credit_reservations (user_id, status);
create index idx_credit_reservations_tool_invocation_id on public.credit_reservations (tool_invocation_id);
create index idx_credit_reservations_generation_run_id on public.credit_reservations (generation_run_id);
create index idx_credit_ledger_entries_user_id_created_at on public.credit_ledger_entries (user_id, created_at desc);
create index idx_credit_ledger_entries_entry_type on public.credit_ledger_entries (entry_type);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

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

-- Authenticated users may read catalog snapshots (no writes via PostgREST).
drop policy if exists pricing_rule_snapshots_authenticated_select on public.pricing_rule_snapshots;
create policy pricing_rule_snapshots_authenticated_select on public.pricing_rule_snapshots
for select
to authenticated
using (true);

-- Owner read-only for user-scoped billing tables; backend service role bypasses RLS for writes.
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

-- billing_webhook_events: no policies for authenticated — reads/writes only via service role.

-- ---------------------------------------------------------------------------
-- Launch pricing snapshot (idempotent)
-- ---------------------------------------------------------------------------

insert into public.pricing_rule_snapshots (version_key, rules_json)
values (
  'launch-v1',
  jsonb_build_object(
    'freeMonthlyCredits', 15,
    'paidMonthlyCredits', 150,
    'fastCredits', 1,
    'qualityCredits', 5,
    'topupCredits', 50,
    'topupPriceUsd', 4,
    'paidPlanPriceUsd', 10
  )
)
on conflict (version_key) do nothing;
