## 1. Admin Guard and Config

- [x] 1.1 Add `ADMIN_SECRET` to `BillingConfigService` — read from `process.env.ADMIN_SECRET`, expose as `adminSecret: string | null`
- [x] 1.2 Create `backend/src/billing/admin/admin.guard.ts` — reads `X-Admin-Secret` header, compares to `config.adminSecret`, throws 401 if missing or wrong
- [x] 1.3 Add `ADMIN_SECRET` to backend env var documentation (`.env.example` or equivalent)

## 2. CreditLedgerService — Manual Credit Ops

- [x] 2.1 Add `issueManualGrant(userId, credits, reason, operatorNote?)` to `CreditLedgerService` — creates a `manual`/`manual` credit grant + `manual_grant` ledger entry via `BillingRepository`; validates user has a billing customer record; rejects `credits <= 0`
- [x] 2.2 Add `issueManualReversal(userId, credits, reason, operatorNote?)` to `CreditLedgerService` — inserts `manual_adjustment` ledger entry with negative delta; deducts from the most-spendable available grant; rejects if reversal would take the grant below zero
- [x] 2.3 Add `listLedgerEntries(userId, limit?)` to `CreditLedgerService` — returns recent `credit_ledger_entries` rows for the user, ordered by `created_at` descending
- [x] 2.4 Add supporting repository methods to `BillingRepository`: `insertManualGrantWithLedger`, `insertManualAdjustmentLedgerEntry`, `listLedgerEntriesByUserId`

## 3. Admin Controller — Credit Ops and Ledger

- [x] 3.1 Create `backend/src/billing/admin/admin.controller.ts` with `@Controller('api/admin') @UseGuards(AdminGuard)`
- [x] 3.2 Add `POST /api/admin/credits/grant` — body: `{ userId, credits, reason, operatorNote? }`; calls `CreditLedgerService.issueManualGrant`
- [x] 3.3 Add `POST /api/admin/credits/reverse` — body: `{ userId, credits, reason, operatorNote? }`; calls `CreditLedgerService.issueManualReversal`
- [x] 3.4 Add `GET /api/admin/users/:userId/ledger` — query: `?limit=50`; calls `CreditLedgerService.listLedgerEntries`
- [x] 3.5 Create DTOs for grant, reversal, and ledger request/response in `backend/src/billing/admin/admin.dto.ts`

## 4. Admin Controller — Webhook Replay

- [x] 4.1 Add repository method `findWebhookEventById(id)` to `BillingRepository` — returns a `billing_webhook_events` row by internal UUID
- [x] 4.2 Add repository method `resetWebhookEventStatus(id)` to `BillingRepository` — sets `processing_status = 'pending'` and clears `error_message`
- [x] 4.3 Add `POST /api/admin/webhooks/:eventId/replay` to `AdminController` — fetches event row, returns 404 if not found, resets status to `pending`, calls `StripeWebhookService.processVerifiedEvent` with stored payload, returns outcome

## 5. Reconciliation View and Admin Endpoint

- [x] 5.1 Create Supabase migration `supabase/migrations/…_add_billing_reconciliation_view.sql` — adds `billing_reconciliation_summary` view joining `credit_ledger_entries` (`debit_settled`) to `generation_runs`/`experience_versions` token columns, grouped by month and tier, with `COALESCE` for nulls
- [x] 5.2 Add `GET /api/admin/reconciliation/summary` to `AdminController` — queries the view via `BillingRepository` and returns JSON rows

## 6. Structured Billing Event Logs

- [x] 6.1 Add `billing.checkout_session_created` log in `StripeCheckoutService` after successful subscription and top-up session creation (include `userId`, `type`)
- [x] 6.2 Add `billing.portal_session_created` log in `StripeCheckoutService` after successful portal session creation (include `userId`)
- [x] 6.3 Add `billing.reservation_created` log in `CreditReservationService` after successful reservation (include `userId`, `toolInvocationId`, `tier`, `credits`)
- [x] 6.4 Add `billing.reservation_released` log in `CreditReservationService` on release (include `userId`, `toolInvocationId`, `reason`)
- [x] 6.5 Add `billing.balance_insufficient` log in `CreditReservationService` when `InsufficientCreditsError` is thrown (include `userId`, `tier`, `requiredCredits`, `availableCredits`)
- [x] 6.6 Add `billing.debit_settled` log in the settlement path (include `userId`, `toolInvocationId`, `experienceVersionId`, `credits`)
- [x] 6.7 Add `billing.manual_grant` and `billing.manual_reversal` logs in `CreditLedgerService` after each operation
- [x] 6.8 Add `billing.webhook_replayed` log in `AdminController` after replay completes (include `eventId`, `stripeEventId`, `outcome`)

## 7. Module Registration

- [x] 7.1 Register `AdminGuard` and `AdminController` in `BillingModule` — add to `controllers` and `providers` arrays
- [x] 7.2 Ensure `CreditLedgerService` is exported from `BillingModule` (it already is; verify it remains so after changes)

## 8. Tests

- [x] 8.1 Unit test `AdminGuard` — correct secret passes, missing secret returns 401, wrong secret returns 401
- [x] 8.2 Unit test `CreditLedgerService.issueManualGrant` — happy path, unknown user rejects, `credits <= 0` rejects
- [x] 8.3 Unit test `CreditLedgerService.issueManualReversal` — happy path, zero-floor guard rejects overage
- [x] 8.4 Unit test webhook replay — failed event is replayed, processed event returns duplicate, unknown ID returns 404

## 9. Billing Runbook

- [x] 9.1 Create `docs/billing/runbook.md` covering: how to identify failed webhook events (Supabase query), webhook replay curl command, manual grant curl command, manual reversal curl command (with zero-floor note), ledger lookup curl command, reconciliation summary curl command and response interpretation
