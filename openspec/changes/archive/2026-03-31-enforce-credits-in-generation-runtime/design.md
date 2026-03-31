## Context

- **Schema:** `credit_reservations` (user_id, status, credits_reserved, credit_grant_id, tool_invocation_id, generation_run_id), `credit_grants` (remaining_credits, reserved_credits), append-only `credit_ledger_entries` with types `reservation_created`, `reservation_released`, `debit_settled`.
- **Runtime:** `GenerateExperienceToolService` calls `selectRoute()` (router → **effective tier**), then `ExperienceOrchestratorService.generate/refine()`. `ChatRuntimeModule` does **not** currently import billing.
- **IDs:** Each tool execution has a persisted **`tool_invocation` row** (`invocationId` in code). `generation_runs.request_id` is a **new UUID inside the orchestrator** per call—use for linking after `recordRunStarted`, but **primary billable correlation** should be **`tool_invocation_id`** for one reservation per tool call (orchestrator internal retries share one `requestId`, matching “one reservation per billable request”).
- **Config:** `BILLING_ENABLED`, `CREDIT_ENFORCEMENT_ENABLED` on `BillingConfigService` (enforcement flag unused today).
- **Entitlement math:** Existing `entitlement-math` + `EntitlementService` / pricing resolution should drive **which grants are charged** and in **which order** (same order as future debit consumption).

## Goals / Non-Goals

**Goals:**

- When **`BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED`**, block **`generate_experience`** before providers if **eligible spendable** credits &lt; cost for the **routed tier** (fast vs quality).
- **Reserve** cost against concrete grant row(s), incrementing **`reserved_credits`**, inserting **`credit_reservations`** (`active`) and ledger **`reservation_created`**, in a **race-safe** way.
- **Release** on any path that does not end in a **persisted new experience version** for that invocation (provider error, validation, safety, timeout, tool-reported failure).
- **Settle** to **exactly one debit** when persistence completes successfully: move reservation to `settled`, decrement `remaining_credits` and `reserved_credits` on affected grants, append **`debit_settled`** (and optionally **`reservation_released`** semantics via status transition only—follow ledger conventions in schema).
- Enforce **at most one settled debit per `tool_invocation_id`** (and no double reserve for same invocation).

**Non-Goals:**

- Stripe checkout, webhooks, paid grant issuance.
- Changing **conversation** provider or tool-calling protocol.
- **Chat UI** polish for low balance (optional small follow-up tasks).
- Materialized balance table or admin dashboards.
- Refunds, manual adjustments, or expiration jobs.

## Decisions

### 1. Where hooks live

**Choice:** Implement reserve / release / settle orchestration in a **dedicated billing service** (e.g. `CreditReservationService` or extend `CreditLedgerService`) called from **`GenerateExperienceToolService`** immediately after **`selectRoute`** (known cost) and around orchestrator success/failure.

**Alternatives:** Hook inside `ExperienceOrchestratorService` — rejected to avoid pulling chat/tool IDs into experience module and duplicating paths for any future non-chat callers until needed.

### 2. Cost basis

**Choice:** Credit cost = **active pricing rule** × **resolved `route.tier`** (`fast` → fast cost, `quality` → quality cost), same source as `/api/billing/me`.

**Alternatives:** User-requested mode only — rejected; roadmap requires charging **actual** routed tier.

### 3. Flag matrix

| BILLING_ENABLED | CREDIT_ENFORCEMENT_ENABLED | Behavior |
|-----------------|----------------------------|----------|
| false | * | No reservation, no debit, no block (current behavior). |
| true | false | **No hard block**; optionally skip writes entirely for v1 (simplest) so staging can show balances without blocking chat. |
| true | true | Full reserve / release / settle. |

**Alternatives:** Always reserve when billing on — rejected for staging flexibility; enforcement flag exists explicitly.

### 4. Concurrency and atomicity

**Choice:** Prefer **one Postgres transaction or `security definer` RPC** that: (a) locks or updates selected grant rows in deterministic order, (b) verifies spendable ≥ cost, (c) increments `reserved_credits`, (d) inserts `credit_reservations` + ledger row. Mirror pattern for release and settle.

**Alternatives:** Read-modify-write in TypeScript only — rejected; two parallel tool calls could overspend.

### 5. Idempotency

**Choice:** **Partial unique index** on `credit_reservations` where `status = 'active'` and `tool_invocation_id` is not null, **or** equivalent “one active reservation per tool_invocation” constraint. Settle uses reservation row id + status check to prevent double settlement.

### 6. Settlement anchor

**Choice:** Link ledger / metadata to **`credit_reservation_id`**, **`credit_grant_id`**, **`tool_invocation_id`**, and **`experience_versions.id`** (or `generation_runs.id`) when available after success.

### 7. Insufficient credits error

**Choice:** Throw or return a **typed `AppError`** (or dedicated billing error code) caught by `ChatToolRegistryService` / tool layer so tool result is **failed** with **normalized error code** consumable by clients (e.g. `INSUFFICIENT_CREDITS`), without calling the orchestrator.

## Risks / Trade-offs

- **[Risk] RPC / migration drift** → Mitigation: mirror migration in `z_billing.sql`; regenerate or patch `supabase.types.ts`.
- **[Risk] Forgotten release path** → Mitigation: `try/finally` in tool service or single wrapper; tests for failure branches; optional defensive “stale active reservation” job later (out of scope).
- **[Risk] Enforcement off in production by mistake** → Mitigation: document in `.env.example`; ops checklist.
- **[Trade-off] generation_run_id null on reserve** → May be filled after `recordRunStarted` in a second update, or left null if tool_invocation is enough for v1.

## Migration Plan

1. Land DB constraints / RPCs first (backward compatible if enforcement off).
2. Deploy backend with **enforcement off** by default; verify no behavior change.
3. Enable **`CREDIT_ENFORCEMENT_ENABLED`** in staging; run manual QA (reserve, success debit, failure release, parallel invocations).
4. Rollback: turn flag off; active reservations may need a one-off release script if any stuck (operational note).

## Open Questions

- Whether **enforcement off** should still write **ledger-only “would have charged”** events (probably no for v1).
- Exact **client copy** for insufficient credits (web follow-up).
- Whether **refine** and **generate** differ in cost only by tier (same rules for both).
