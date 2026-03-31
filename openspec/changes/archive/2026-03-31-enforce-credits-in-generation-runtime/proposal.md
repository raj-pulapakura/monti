## Why

Monti can display balances and issue free monthly grants (`GET /api/billing/me`), but **`generate_experience` never reserves, debits, or releases credits**. The monetization roadmap Proposal 4 and existing specs (`experience-generation`, `billing-credit-entitlements`) already describe reserve-then-settle behavior—this change implements it so successful runs charge exactly once, failed runs charge zero, and concurrent generations cannot overspend.

## What Changes

- Wire **credit reservation, release, and settlement** into the **`generate_experience` tool path** after routing selects the effective tier (`fast` / `quality`) and **before** any provider-backed generation work.
- Use existing **`credit_reservations`**, **`credit_grants.reserved_credits`**, and **`credit_ledger_entries`** (`reservation_created`, `reservation_released`, `debit_settled`) with **atomic DB operations** where concurrent users could otherwise race.
- Anchor each billable charge to a **single persisted `tool_invocation`** (and link to **`generation_runs`** when available) so idempotency and audit stay traceable.
- Respect **`BILLING_ENABLED`** and **`CREDIT_ENFORCEMENT_ENABLED`**: when billing is off, skip the credit path; when billing is on but enforcement is off, allow generation without blocking (no hard gate) while leaving room for optional logging later.
- Return **billing-specific insufficient-credit** outcomes to the conversation/tool layer when enforcement is on and balance is inadequate.
- Add **tests** for reserve/release/settle, duplicate-invocation safety, and insufficient credits.
- Optional **follow-up** in the same change or a thin slice: **soft UI** hints on home/chat (roadmap mentions this; can be deferred via tasks).

## Capabilities

### New Capabilities

_(none — requirements already exist in canonical specs; this change adds delta clarifications and implementation.)_

### Modified Capabilities

- `billing-credit-entitlements`: Add explicit requirements for **enforcement flags**, **tool-invocation anchoring**, and **at-most-one active reservation per billable tool invocation** where not already stated.
- `experience-generation`: Add explicit requirements for **when the credit path is skipped** (billing off) vs **observation-only** (enforcement off) vs **hard gate** (both on), so implementation matches product intent without contradicting existing reserve/settle requirements.

## Impact

- **Backend:** `GenerateExperienceToolService`, `ChatRuntimeModule` (import billing services), `BillingRepository` / new services or RPCs, `CreditLedgerService`, possibly `ExperienceOrchestratorService` or persistence only if settlement must align with `generation_runs` / version ids.
- **Database:** Possible new **unique partial index** on `credit_reservations` for idempotency; optional **Postgres functions** for reserve/release/settle (same pattern as free monthly grant RPC).
- **API / clients:** Structured **insufficient-credit** errors observable in tool results and events (exact shape in design).
- **Dependencies:** `ChatRuntimeModule` → `BillingModule` (or a narrower exported facade).
