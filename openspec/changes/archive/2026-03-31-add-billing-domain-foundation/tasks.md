## 1. Database schema

- [x] 1.1 Add a Supabase migration that creates `billing_customers`, `billing_subscriptions`, `billing_checkout_sessions`, `billing_webhook_events`, `pricing_rule_snapshots`, `credit_grants`, `credit_reservations`, and `credit_ledger_entries` with primary keys, foreign keys to `auth.users` where appropriate, and uniqueness constraints per `design.md` (user id, Stripe ids, webhook event id).
- [x] 1.2 Add check constraints or enums for reservation lifecycle state and ledger entry types as decided during implementation; include indexes for common lookups (`user_id`, `stripe_*`, processing status on webhook events).
- [x] 1.3 Add RLS policies consistent with `design.md`: user-scoped read where applicable; no broad authenticated write to ledger or webhook tables; align with existing project RLS patterns.
- [x] 1.4 Add declarative schema in `supabase/schemas/z_billing.sql` (sorts after `experiences.sql` so `_set_updated_at` exists) matching the migration.

## 2. Generated types and configuration docs

- [x] 2.1 Regenerate or update `backend/src/supabase/supabase.types.ts` to include new tables and enums.
- [x] 2.2 Document new billing environment variables in `backend/.env.example` with safe defaults and short comments (flags off; Stripe placeholders empty).

## 3. Nest billing module (scaffolding only)

- [x] 3.1 Create `backend/src/billing/billing.module.ts` importing `SupabaseModule` and registering foundation providers.
- [x] 3.2 Implement `BillingConfigService` to parse feature flags and launch catalog constants from environment (defaults must keep billing off in dev).
- [x] 3.3 Implement `BillingRepository` (or split repositories if clearer) with typed methods for inserting/selecting foundation rows needed by follow-up changes; avoid unused complex queries until needed.
- [x] 3.4 Add thin stubs for `CreditLedgerService` and `EntitlementService` (or equivalent) that compile and are injectable but do not call chat runtime.
- [x] 3.5 Import `BillingModule` in `backend/src/app.module.ts`.

## 4. Verification

- [x] 4.1 Add unit tests for `BillingConfigService` flag parsing and default behavior.
- [x] 4.2 Add minimal tests or health checks proving `BillingModule` bootstraps in the Nest test module without side effects.
- [x] 4.3 Run backend test suite and fix any regressions.

## 5. Spec and archive hygiene

- [x] 5.1 After implementation, update root `openspec/specs/billing-domain-persistence/spec.md` from this change delta per project archive workflow (handled at archive time if that is the convention).
- [x] 5.2 Optionally seed one `pricing_rule_snapshots` row for the launch catalog via migration or documented manual step—record the choice in the implementation PR if not in migration.
