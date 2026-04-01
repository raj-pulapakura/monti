## Why

Monti now has a production billing system — Stripe integration, credit grants, webhook processing, and runtime enforcement — but no tooling to operate it. When something goes wrong in production (a failed webhook, a confused user, a support request), there is no way to diagnose or correct it without ad hoc SQL and guesswork.

## What Changes

- **Admin API surface**: a dedicated `AdminController` protected by a shared-secret `AdminGuard`, exposing endpoints for webhook replay, manual credit ops, and reconciliation
- **Manual credit operations**: `CreditLedgerService` (currently a stub) is filled out with `issueManualGrant`, `issueManualReversal`, and `listLedgerEntries`
- **Webhook replay**: admin endpoint to re-drive a failed `billing_webhook_events` row through the existing webhook processing pipeline
- **Reconciliation view**: a Supabase migration adds a `billing_reconciliation_summary` view joining credit debits to actual model token cost, plus a lightweight admin endpoint to query it
- **Structured billing event logs**: consistent structured log events added across billing boundaries (checkout session created, portal session created, reservation created/released/insufficient, debit settled, manual adjustment)
- **Billing runbook**: `docs/billing/runbook.md` documents every admin operation with exact curl commands, expected responses, and recovery procedures

## Capabilities

### New Capabilities

- `billing-admin-ops`: Admin-protected API for manual credit grants, reversals, ledger reads, webhook replay, and reconciliation queries
- `billing-observability`: Structured log events at every billing boundary and a billing runbook documenting operational procedures

### Modified Capabilities

- `billing-domain-persistence`: Reconciliation view added to schema; `CreditLedgerService` stub filled out with manual credit op methods

## Impact

- **New**: `backend/src/billing/admin/` — `AdminGuard`, `AdminController`, admin DTOs
- **New**: `backend/src/billing/admin/admin-credit.service.ts` (or expanded `CreditLedgerService`)
- **Modified**: `backend/src/billing/credit-ledger.service.ts` — stub becomes real service
- **Modified**: `backend/src/billing/billing.module.ts` — registers new admin providers
- **Modified**: `backend/src/billing/billing.controller.ts`, `stripe-checkout.service.ts`, `credit-reservation.service.ts` — structured log events added
- **New**: `supabase/migrations/…_add_billing_reconciliation_view.sql`
- **New**: `docs/billing/runbook.md`
- **New env var**: `ADMIN_SECRET`
