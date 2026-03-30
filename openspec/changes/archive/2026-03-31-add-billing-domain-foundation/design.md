## Context

Monti authenticates users with Supabase JWTs; the Nest backend already uses `SupabaseModule` and repositories for chat and experience persistence. Published specs (`billing-credit-entitlements`, `billing-payment-lifecycle`) define entitlement behavior, reservations, and Stripe as payment source of truth, but the repo has **no** billing tables, `BillingModule`, or billing env wiring yet. Telemetry for cost analysis is already persisted on generation and conversation paths.

## Goals / Non-Goals

**Goals:**

- Persist a coherent billing data model that can support: Stripe customer mapping, subscription mirror, checkout session audit trail, idempotent webhook processing, credit grants, reservations, immutable ledger entries, and pricing-rule snapshots tied to debits/grants.
- Enforce **database-level** integrity: unique Stripe identifiers where applicable, unique processed webhook event IDs, append-only ledger semantics (no updates/deletes on ledger rows except controlled compensating entries if ever needed—launch assumes insert-only ledger).
- Add Nest `BillingModule` with configuration for launch catalog constants, pricing-rule version identity, and feature flags read from environment (defaults safe for local dev).
- Provide repository/service scaffolding so a follow-up change can implement grant math, `GET /api/billing/me`, and Stripe without another migration pass—acknowledging that some columns may be refined in later proposals if Stripe shapes demand it.

**Non-Goals:**

- Stripe Checkout, Customer Portal, webhook HTTP endpoint, or `stripe` npm package integration (separate change).
- Runtime credit enforcement, reservation creation in `GenerateExperienceToolService`, or user-visible billing UI.
- Automatic backfill of credits for existing users (rollout change).
- Admin UI, support tooling, reconciliation jobs, and observability dashboards (later ops change).
- Final legal copy or tax configuration.

## Decisions

### 1. Table set and naming

Align table names with the monetization roadmap’s conceptual entities, using snake_case plural table names consistent with existing Supabase style:

| Table | Role |
| --- | --- |
| `billing_customers` | Maps `user_id` (Supabase auth user UUID) to `stripe_customer_id`; lazy creation supported by nullable `stripe_customer_id` until first Stripe action in a later change, or store only after creation—design allows one row per user early. |
| `billing_subscriptions` | Internal mirror of subscription state (Stripe subscription id, status, current period boundaries, cancel-at-period-end, etc.). |
| `billing_checkout_sessions` | Records initiated Checkout sessions (mode, Stripe session id, intent: subscription vs top-up, created_at, user_id). |
| `billing_webhook_events` | Raw payload reference or stored event id, type, processing status, error, for idempotent replay. |
| `credit_grants` | Grant records (source, amount, bucket kind, cycle boundaries, pricing_rule_snapshot_id, optional stripe references). |
| `credit_reservations` | Holds against buckets for in-flight billable work (linked to tool invocation / generation correlation in a later change; nullable FKs acceptable at foundation). |
| `credit_ledger_entries` | Immutable append-only ledger (entry type, amounts, references to grant/reservation/debit anchors). |
| `pricing_rule_snapshots` | Versioned rule rows (version key, JSON or columns for fast/quality costs and monthly allowances) for auditability. |

**Alternatives considered:** Fewer tables (e.g. embed checkout on customers)—rejected to keep webhook and funnel debugging tractable.

### 2. Primary keys and uniqueness

- `billing_customers.user_id`: unique (one mapping row per Monti user).
- Stripe IDs (`stripe_customer_id`, `stripe_subscription_id`, `stripe_checkout_session_id`, `stripe_event_id`): unique where stored, with partial uniqueness if nullable columns are used before Stripe exists.
- `billing_webhook_events`: unique on Stripe event id (idempotency).

### 3. RLS and access pattern

- **User-scoped read** policies where a signed-in user may eventually read their own billing summary (match existing project RLS style from `20260316000100_add_authenticated_user_scoping.sql` patterns).
- **Writes** for webhook processing, ledger append, and subscription sync are expected to use the **service role** from the backend (same pattern as other privileged persistence). Avoid exposing raw ledger mutation RPCs to the anon/authenticated role.

**Alternatives considered:** All service-role-only with no user RLS—rejected for long-term safety of direct Supabase client reads if introduced later.

### 4. Nest module layout

- `backend/src/billing/billing.module.ts` imports `SupabaseModule` (and `ConfigModule` if used elsewhere for env).
- Services (initial): `BillingConfigService` (flags + catalog + active pricing snapshot version resolution stub), `BillingRepository` (typed Supabase access), placeholders for `CreditLedgerService` / `EntitlementService` as thin facades or empty classes with interfaces—**no** calls from chat runtime yet.

**Alternatives considered:** Single mega-repository—rejected to keep ledger vs customer concerns separable for testing.

### 5. Environment variables

Introduce documented variables (implementation may parse with defaults `false` / empty):

- `BILLING_ENABLED`, `CREDIT_ENFORCEMENT_ENABLED`, `STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `FREE_CREDIT_GRANTS_ENABLED`, `TOPUPS_ENABLED`
- Placeholders for future Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PAID_MONTHLY`, `STRIPE_PRICE_ID_TOPUP_50` (optional empty until integration change)

### 6. Migrations and declarative schema

- Add a timestamped migration under `supabase/migrations/` following existing `YYYYMMDDHHMMSS_description.sql` convention.
- Update declarative snapshot under `supabase/schemas/` if the repo requires parity (match what telemetry change did for `experiences.sql` / related files—billing may warrant `billing.sql` or a dedicated file per project convention).

### 7. Type generation

Regenerate `backend/src/supabase/supabase.types.ts` after migration (or document the command in tasks) so Nest code stays typed.

## Risks / Trade-offs

- **[Risk] Schema drift vs future Stripe fields** → Mitigation: keep subscription and checkout tables focused on fields needed for idempotency and entitlement mirror; add columns in the Stripe integration change if webhook payloads need more.
- **[Risk] Over-modeling reservations before runtime correlation is wired** → Mitigation: include nullable correlation columns (`tool_invocation_id`, `generation_run_id`, etc.) and minimal state enum; enforce invariants in application code in the enforcement change.
- **[Risk] RLS complexity slows first merge** → Mitigation: start with conservative policies (e.g. user reads own `billing_customers` and derived views only if needed); defer broad “ledger visible to user” to the billing workspace change.

## Migration Plan

1. Apply Supabase migration to dev/staging.
2. Deploy backend with `BillingModule` imported; all flags default off—no behavior change.
3. Verify migration applies cleanly and types regenerate; run backend tests.
4. Rollback: revert migration via down migration or manual drop in dev only (ship forward migration only if project standard is forward-only).

## Open Questions

- Whether to seed a row in `pricing_rule_snapshots` for the launch catalog in this change vs the grants/entitlements change.
- Exact Postgres enum vs text check constraints for `credit_ledger_entries.entry_type` and reservation status.
- Whether `billing_customers` is created on first sign-up (background) or lazily on first billing action only—foundation can support either; grants change should pick one.
