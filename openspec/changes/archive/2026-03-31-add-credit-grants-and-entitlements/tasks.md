## 1. Schema and types

- [x] 1.1 Add a Supabase migration that enforces idempotent free monthly grants (partial unique index on `credit_grants` for `recurring_free` scoped by `user_id` and `cycle_start`, or equivalent constraint per `design.md`).
- [x] 1.2 Update `supabase/schemas/z_billing.sql` to match the migration.
- [x] 1.3 Regenerate or hand-update `backend/src/supabase/supabase.types.ts` for any schema change.

## 2. Entitlement domain (backend)

- [x] 2.1 Extend `BillingRepository` (admin client) to load grants, subscription mirror rows, and insert grant + ledger in one logical operation.
- [x] 2.2 Implement `EntitlementService` to compute UTC month boundaries, ensure the current-month `recurring_free` grant exists when flags allow, append `free_monthly_grant` ledger rows on create, and compute paid entitlement active from `billing_subscriptions.current_period_end`.
- [x] 2.3 Implement deterministic bucket eligibility, ordering, top-up freeze, and spendable totals using `max(remaining_credits - reserved_credits, 0)` per `design.md`.
- [x] 2.4 Map active pricing from `pricing_rule_snapshots` / `LAUNCH_PRICING_VERSION_KEY` (or config) into fast/quality costs and included allowance for free grants.

## 3. HTTP API

- [x] 3.1 Add `BillingController` with `GET /api/billing/me`, `AuthGuard`, and response DTOs including `billingEnabled`, plan tier, costs, aggregates, buckets, `nextIncludedRefreshAt`, and `paidPeriodEndsAt`.
- [x] 3.2 Register the controller in `BillingModule` and verify routing prefix matches existing backend URL patterns (`/api/...`).
- [x] 3.3 When `BILLING_ENABLED` is false, return the safe payload defined in the spec without error.

## 4. Web (authenticated home)

- [x] 4.1 Add a small client helper or reuse existing backend fetch utilities to call `GET /api/billing/me` with the user session token (same pattern as chat API calls).
- [x] 4.2 Update `web/app/page.tsx` (or a focused child component) to render the billing summary when enabled and handle disabled/failed states without blocking thread creation.

## 5. Tests and verification

- [x] 5.1 Add unit tests for entitlement math (ordering, top-up freeze, paid period, spendable formula, month boundaries).
- [x] 5.2 Add tests for free-grant idempotency and ledger pairing (repository or service level with mocked Supabase as appropriate).
- [x] 5.3 Add controller-level test for `/api/billing/me` mapping and billing-disabled behavior.
- [x] 5.4 Run `npm test` and `npm run build` in `backend`; run web lint/tests if present in the repo.

## 6. Spec hygiene at archive

- [x] 6.1 When archiving, merge deltas into `openspec/specs/billing-credit-entitlements/spec.md` and `openspec/specs/home-screen-workspace/spec.md` per project convention.
