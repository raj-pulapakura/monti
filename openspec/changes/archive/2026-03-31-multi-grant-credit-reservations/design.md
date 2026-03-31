## Context

Credit enforcement uses Postgres RPCs (`billing_reserve_generation_credits`, `billing_release_generation_reservation`, `billing_settle_generation_reservation`) and `credit_reservations` rows keyed by `tool_invocation_id`. A partial unique index currently allows at most **one** active reservation per invocation. `billing_reserve_generation_credits` selects a single grant with `LIMIT 1` and reserves the full cost on that row. Backend services (`credit-reservation.service.ts`, billable tools such as `generate-experience-tool.service.ts`) assume a single `reservationId` (and single pricing snapshot) per run.

The entitlement spec already requires deterministic consumption order across buckets (`recurring` by earliest expiry, then `top-up` by oldest grant). Multi-bucket reservation is the missing piece when **aggregate** spendable balance suffices but **no single** bucket covers the line item.

## Goals / Non-Goals

**Goals:**

- Reserve the full quoted cost for one billable `tool_invocation_id` across **one or more** `credit_grant` rows in **one** database transaction, following the same eligibility and ordering rules as single-bucket spend.
- Preserve **exactly-once settlement** per invocation: repeated reserve/settle calls for the same invocation must not double-debit; success path converts all active slices to settled debits; failure path releases all slices.
- Prefer an application contract that does not require the caller to track a list of reservation UUIDs for release/settle (invocation-scoped RPCs or a structured return that the service wraps).

**Non-Goals:**

- Changing pricing, grant lifecycle, or bucket ordering rules beyond what is required to allocate slices.
- UI or API changes to `GET /api/billing/me` beyond what falls out naturally from correct reservation math (unless a gap is discovered during implementation).

## Decisions

1. **Uniqueness model** — Replace “at most one active row per `tool_invocation_id`” with “at most one active row per (`tool_invocation_id`, `credit_grant_id`)”. Rationale: multiple grants per invocation are allowed; the same grant must not have two active slices for the same invocation. Alternative: drop uniqueness and enforce in RPC only — rejected as weaker concurrency story.

2. **Allocation algorithm** — In `billing_reserve_generation_credits`, walk eligible grants in deterministic order (matching existing entitlement ordering), subtracting `min(remaining_spendable_on_grant, cost_left)` per row until `cost_left = 0` or exhaust grants; insert one `credit_reservations` row (and ledger line if applicable) per slice. Rationale: mirrors “consume deterministically” without a second ordering definition.

3. **Idempotency** — On duplicate reserve for the same `tool_invocation_id`, return the **existing** slice set (or no-op extend) rather than relying on “first row wins” `LIMIT 1`. Rationale: multiple rows per invocation breaks naive `limit 1` idempotency.

4. **Release / settle API** — Add or evolve RPCs so release and settle take **`tool_invocation_id`** (and tenant/user guards) and affect **all** active reservation rows for that invocation in one transaction. Rationale: tools keep one invocation key; avoids leaking N IDs through the Nest stack. Alternative: return N reservation IDs from reserve and thread them through — valid but error-prone; use only if invocation-scoped RPCs prove too heavy.

5. **Backend shape** — `CreditReservationService` exposes reserve → `{ slices: [...] }` or hides slices and stores only `toolInvocationId` for settle/release. Rationale: align public method signatures with the RPC contract chosen in (4).

## Risks / Trade-offs

- **[Risk] Migration on production data** — Dropping/recreating the partial unique index could briefly lock `credit_reservations`. → Mitigation: deploy in low traffic; use `CONCURRENTLY` if the project standard allows; verify no duplicate active rows per (invocation, grant) before applying.

- **[Risk] Partial implementation** — Updating reserve without settle/release leaves stuck reservations. → Mitigation: ship RPC + service + tool path in one change; add tests that split across two grants and assert release clears both.

- **[Trade-off] RPC breaking change** — Callers and generated types must update together. → Mitigation: single PR; grep for old RPC names/signatures.

## Migration Plan

1. Add new migration: new partial unique index on `(tool_invocation_id, credit_grant_id)` where active; drop old partial unique on `tool_invocation_id` alone (after confirming compatibility with in-flight rows).
2. Deploy updated RPC definitions (reserve / release / settle) in the same migration or a follow-up in the same release.
3. Deploy backend using new types and service; no feature flag required if old RPCs are removed atomically—otherwise gate `BILLING_*` paths only when coordinated.

**Rollback:** Revert migration and application together; avoid leaving DB on new index without matching app code.

## Open Questions

- Whether settlement produces **one** debit aggregate row with multiple ledger lines vs **one ledger line per slice** (both can satisfy audit if traceable to grants); confirm against existing `credit_ledger_entries` conventions in code.
- Exact shape of reserve RPC return JSON for the Nest layer (array of `{ reservationId, creditGrantId, credits, pricingRuleSnapshotId }` vs opaque payload).
