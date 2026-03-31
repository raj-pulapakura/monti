## 1. Database schema and RPCs

- [x] 1.1 Add migration: replace partial unique index on `credit_reservations` so uniqueness is `(tool_invocation_id, credit_grant_id)` where active (drop old `tool_invocation_id`-only unique); verify no conflicting active rows before apply.
- [x] 1.2 Rewrite `billing_reserve_generation_credits` to allocate cost across eligible grants in deterministic order in one transaction; insert one active reservation row per slice; implement idempotent re-entry for the same `tool_invocation_id` (return existing slice set, no double hold).
- [x] 1.3 Update `billing_release_generation_reservation` and `billing_settle_generation_reservation` (or successor RPCs) to target all active rows for a `tool_invocation_id` with correct auth guards; ensure settle/release are each idempotent when called again for the same invocation.
- [x] 1.4 Keep `supabase/schemas/z_billing.sql` (or equivalent) in sync with the migration if the repo maintains parallel schema sources.

## 2. Types and backend service

- [x] 2.1 Regenerate or hand-update `backend/src/supabase/supabase.types.ts` (and any RPC typings) for new/changed function signatures and return shapes.
- [x] 2.2 Refactor `credit-reservation.service.ts` to use the new reserve/release/settle contract (invocation-scoped or multi-slice handling per design); remove assumptions of a single `reservationId` where obsolete.
- [x] 2.3 Update `generate-experience-tool.service.ts` (and any other billable tool paths) to call the updated service API and handle success/failure without leaking partial release.

## 3. Tests and verification

- [x] 3.1 Update unit/integration tests and Supabase mocks for multi-slice reserve, full release on failure, single settle on success, and idempotent reserve.
- [x] 3.2 Add a test case where two grants split one invocation cost (insufficient per grant, sufficient in aggregate) and assert ordering matches entitlement rules.
- [x] 3.3 Run the project’s billing-related test suite and fix regressions.

## 4. Spec workflow

- [x] 4.1 After implementation, run OpenSpec archive/apply workflow per project docs so `billing-credit-entitlements` delta merges into `openspec/specs/` when appropriate.
