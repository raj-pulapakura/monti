## Context

Monti's billing system is complete end-to-end: Stripe checkout, webhook processing, credit grants, reservations, settlement, and runtime enforcement are all in production. However, there is no tooling to operate it. When a webhook fails, it stays failed. When a user needs a goodwill credit, there is no supported path. When leadership asks whether credits are profitable, there is no answer.

The billing module has one meaningful stub left: `CreditLedgerService` is an empty `@Injectable()` class registered in `BillingModule` but never populated. This is the natural home for manual credit operations.

The `billing_webhook_events` table already tracks `processing_status` and `error_message`, so failed events are visible — they just cannot be replayed without an API.

The ledger schema already defines `manual_grant` and `manual_adjustment` entry types. The wiring to produce them just does not exist yet.

## Goals / Non-Goals

**Goals:**
- Admin-protected API for webhook replay, manual credit grants/reversals, and reconciliation
- `CreditLedgerService` filled out with manual credit operation methods
- Structured log events at every meaningful billing boundary
- SQL reconciliation view joining credit debits to model token cost
- Billing runbook documenting all admin operations with exact curl commands

**Non-Goals:**
- Admin UI — all admin operations are invoked via HTTP with a secret header
- Per-operator audit identity — a shared secret is sufficient for launch
- Automated alerting or dashboards — structured logs provide the raw signal; alerting is a future concern
- Webhook retry scheduling — Stripe already retries on non-2xx; replay here is for manual recovery of events that reached `failed` state after Stripe stopped retrying

## Decisions

### 1. AdminGuard uses a shared secret header, not a user JWT

`AdminGuard` reads `X-Admin-Secret` from the request headers and compares it to `ADMIN_SECRET` from env. Returns 401 if missing or wrong.

**Alternatives considered:**
- Supabase JWT with admin role claim — requires JWT mutation and couples admin access to user identity; unnecessary complexity for a single operator
- Allowlist of user IDs in env — still requires a JWT and redeploy to add operators; no advantage over a shared secret at this scale

**Why shared secret:** The admin surface is an ops tool, not a product feature. A single operator using curl does not need identity, sessions, or role management.

### 2. CreditLedgerService becomes the manual credit ops service

`CreditLedgerService` gains three methods:
- `issueManualGrant(userId, credits, reason, operatorNote)` — inserts a `manual` source credit grant + `manual_grant` ledger entry
- `issueManualReversal(userId, credits, reason, operatorNote)` — inserts a `manual_adjustment` ledger entry with negative delta, deducting from the most-spendable available grant
- `listLedgerEntries(userId, limit)` — returns recent ledger rows for support lookups

This keeps all credit mutation behind a service boundary (no raw SQL from controllers), ensures ledger entries are always paired with grant mutations, and gives a clear place to add audit logging later.

### 3. Webhook replay re-drives the existing pipeline

`POST /api/admin/webhooks/:eventId/replay` fetches the stored `billing_webhook_events` row by its internal ID, resets its `processing_status` to `pending`, and calls `StripeWebhookService.processVerifiedEvent` with the stored payload. The existing idempotency logic in `processVerifiedEvent` naturally handles dedup on `stripe_event_id` — so replay of an already-processed event is safe and returns `'duplicate'`.

**Why re-use the existing pipeline:** The event payload and all handler logic already lives in `StripeWebhookService`. Duplicating it in an admin path would diverge over time.

**Important:** Replay resets status to `pending` before processing so the idempotency insert can succeed again if the event previously reached `processed` state and the operator is intentionally replaying it (e.g. to re-grant credits after a schema fix). If it was `processed` and the operator is replaying by mistake, the duplicate return prevents any double-grants.

### 4. Reconciliation is a SQL view plus one read-only admin endpoint

A migration adds `billing_reconciliation_summary` as a Postgres view joining:
- `credit_ledger_entries` where `entry_type = 'debit_settled'` (credits consumed)
- `generation_runs` / `experience_versions` token columns (actual model cost)
- Grouped by calendar month and quality tier

`GET /api/admin/reconciliation/summary` queries this view and returns JSON. No aggregation logic lives in the backend — the view does the math.

**Why a view, not a materialized view:** At launch volume, a plain view is fast enough and always current. A materialized view adds refresh complexity with no benefit yet.

### 5. Structured logs use NestJS Logger with consistent event keys

Every billing boundary emits a structured `logger.log(message, context)` call where `context` is a plain object with a stable `event` key. This matches the existing pattern in `ConversationLoopService` and `ChatRuntimeService`.

Event keys to add:
- `billing.checkout_session_created` — type, userId
- `billing.portal_session_created` — userId
- `billing.reservation_created` — userId, toolInvocationId, tier, credits
- `billing.reservation_released` — userId, toolInvocationId, reason
- `billing.debit_settled` — userId, toolInvocationId, experienceVersionId, credits
- `billing.balance_insufficient` — userId, tier, requiredCredits, availableCredits
- `billing.manual_grant` — userId, credits, reason, operatorNote
- `billing.manual_reversal` — userId, credits, reason, operatorNote
- `billing.webhook_replayed` — eventId, stripeEventId, outcome

### 6. AdminController lives in a subdirectory

`backend/src/billing/admin/` contains `AdminGuard`, `AdminController`, and DTOs. This keeps admin concerns isolated from the user-facing billing module files and makes the security boundary visually obvious.

`AdminController` is registered in `BillingModule` alongside `BillingController` — no separate module needed.

## Risks / Trade-offs

**Shared secret has no rotation ceremony** → Document rotation in the runbook. Since it is an env var, rotation requires a backend redeploy. Acceptable for launch.

**Manual reversal can produce negative remaining_credits on a grant** → Add a guard in `CreditLedgerService.issueManualReversal` that rejects if the reversal would take any targeted grant below zero. Surface a clear error to the operator.

**Replay resets processing_status** → If an operator replays a `processed` event carelessly, the idempotency check prevents double-grants, but the `processing_status` row gets reset and re-processed, mutating `processed_at`. Acceptable — the operator explicitly requested replay.

**Reconciliation view joins on nullable token columns** → Some early `generation_runs` rows may have null token data (pre-telemetry). The view should use `COALESCE` to zero these out and exclude them from cost estimates, with a note in the runbook.

## Migration Plan

1. Deploy backend with `ADMIN_SECRET` env var set (feature is inert without it)
2. Run Supabase migration to add reconciliation view
3. Smoke-test admin endpoints from local curl against staging
4. Document runbook curl commands verified against staging responses
5. No rollback complexity — admin endpoints are additive; reconciliation view is read-only

## Open Questions

None — all decisions made during explore phase.
