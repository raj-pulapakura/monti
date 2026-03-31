## Why

Today a single generation can only reserve credits from one `credit_grant` row because the database enforces at most one active reservation per `tool_invocation_id`. Users with split balances across buckets (for example leftover free-cycle credits plus a paid recurring grant) cannot spend the combined total in one run when no single bucket covers the full cost. Multi-bucket reservation aligns enforcement with the product rule that spend follows deterministic bucket order across all eligible grants.

## What Changes

- Allow one billable `tool_invocation_id` to hold **multiple** active reservation rows—one slice per `credit_grant` used—while preserving **at most one debit** on success and full release on failure.
- Update `billing_reserve_generation_credits` (or equivalent) to allocate cost across grants in **deterministic bucket order** within a single transaction when one grant is insufficient.
- Change release/settle entry points so callers can finalize or unwind **all slices** for a tool invocation without passing N opaque reservation IDs from application code (recommended: RPCs keyed by `tool_invocation_id` that affect every active reservation for that invocation).
- Replace the unique partial index on `(tool_invocation_id)` where active with a uniqueness rule that permits multiple active rows per invocation **per grant** (for example unique on `(tool_invocation_id, credit_grant_id)` where active).
- Update backend credit-reservation service and generate-experience (and any other billable tool paths) to use the new contract; regenerate Supabase types and tests/mocks accordingly.

## Capabilities

### New Capabilities

- _(none — behavior is an extension of existing billing entitlements.)_

### Modified Capabilities

- `billing-credit-entitlements`: Clarify that a single billable request may reserve credits across **multiple** entitlement buckets in one atomic reservation pass, still settling to **one** debit (or releasing **all** held slices) per invocation; idempotency and “exactly once” apply to the **request**, not to a single grant row.

## Impact

- **Database**: New migration adjusting `credit_reservations` partial unique index; RPC changes for reserve / release / settle; possible updates to `supabase/schemas/z_billing.sql` if the repo keeps schema files in sync with migrations.
- **Backend**: `credit-reservation.service.ts`, `generate-experience-tool.service.ts`, `supabase.types.ts`, unit/integration tests and RPC mocks.
- **API contract**: RPC signatures and return shapes may change (for example composite reservation payload or invocation-scoped settle/release); treat as **BREAKING** for any external consumers of these RPCs (internal Nest callers must be updated in the same change).
