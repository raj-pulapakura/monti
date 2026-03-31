## 1. Schema and types

- [x] 1.1 Add migration (and `z_billing.sql`) for reservation idempotency: e.g. partial unique index on `credit_reservations` for at most one **active** row per `tool_invocation_id`, or equivalent constraint.
- [x] 1.2 Add Postgres RPCs or documented transactions for **reserve**, **release**, and **settle** that update `credit_grants.reserved_credits` / `remaining_credits` and `credit_reservations.status` atomically with ledger inserts.
- [x] 1.3 Update `backend/src/supabase/supabase.types.ts` for new RPCs or schema changes.

## 2. Billing domain services

- [x] 2.1 Implement reservation/settlement service (extend `CreditLedgerService` or new service) using admin client + RPCs; inject `BillingConfigService` for flags.
- [x] 2.2 Resolve per-invocation credit cost from routed tier + pricing snapshot / catalog (reuse `resolvePricingFromSnapshot` or shared helper with `EntitlementService`).
- [x] 2.3 Map insufficient balance to a stable `AppError` (or dedicated error code) suitable for tool results and HTTP observers.

## 3. Chat runtime integration

- [x] 3.1 Import `BillingModule` into `ChatRuntimeModule` and wire the reservation service into `GenerateExperienceToolService`.
- [x] 3.2 After `selectRoute`, when flags require enforcement: reserve or fail fast; pass through `tool_invocation_id` / `userId`.
- [x] 3.3 On successful persisted artifact (same path that returns success today): settle reservation and debit grants once.
- [x] 3.4 On all failure / early-exit paths before persisted version: release reservation (try/finally or equivalent so no path is missed).
- [x] 3.5 Optionally update `credit_reservations.generation_run_id` after `generation_runs` exists if design chooses to link it. _(Deferred: not implemented; `tool_invocation_id` is sufficient for v1.)_

## 4. Tests

- [x] 4.1 Unit tests for flag matrix (skip reserve, no block when enforcement off, block when on + zero balance).
- [x] 4.2 Tests for settle-once and release-on-failure (mocked DB or repository).
- [x] 4.3 Integration or contract tests for `GenerateExperienceToolService` with billing mocks: success debits, failure releases.

## 5. Verification and docs

- [x] 5.1 Run `npm test` and `npm run build` in `backend`.
- [x] 5.2 Update `backend/.env.example` with short comments for `CREDIT_ENFORCEMENT_ENABLED` behavior alongside `BILLING_ENABLED`.
- [x] 5.3 Optional: minimal web soft-gating or copy for insufficient credits (deferred).

## 6. Spec hygiene at archive

- [x] 6.1 Merge deltas into `openspec/specs/billing-credit-entitlements/spec.md` and `openspec/specs/experience-generation/spec.md` per project convention.
