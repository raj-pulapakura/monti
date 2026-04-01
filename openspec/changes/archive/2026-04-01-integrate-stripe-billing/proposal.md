## Why

Monti already persists billing entities, computes entitlements, and can enforce credits in the generation runtime, but **no code path collects money or syncs Stripe subscription lifecycle** into that model. Without Stripe Checkout, webhooks, and Customer Portal, paid plans and top-ups cannot ship. This change implements **Proposal 5** from `docs/pricing/monetization-roadmap.md` so verified Stripe events become the authority for paid grants and subscription state, matching the existing monetization contract specs.

## What Changes

- Add the **Stripe server SDK** to the Nest backend and a small integration layer (customer ensure, Checkout Session creation for subscription and one-time top-up, Billing Portal sessions).
- Expose **authenticated** HTTP endpoints: `POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`, `POST /api/billing/portal`, returning URLs for **Stripe-hosted Checkout** / portal redirect (no frontend Stripe.js required for launch).
- Add a **`POST /api/billing/webhooks/stripe`** handler that reads the **raw body**, verifies the **Stripe-Signature** with `STRIPE_WEBHOOK_SECRET`, persists events for **idempotency**, and dispatches handlers for the agreed event types.
- **Upsert** `billing_customers` (Stripe customer id), `billing_subscriptions` mirror, `billing_checkout_sessions` rows as needed, and create **paid monthly** and **top-up** `credit_grants` + ledger entries only from **verified** webhook authority (not success/cancel redirects), aligned with `billing-payment-lifecycle` and `billing-credit-entitlements`.
- Respect existing flags (`STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `TOPUPS_ENABLED`, `BILLING_ENABLED`) so integration can roll out safely; document required env vars in `.env.example`.
- Register **Nest** wiring so the webhook route can use **raw body** parsing without breaking JSON parsing on other routes.

## Capabilities

### New Capabilities

- (none) — behavioral requirements for checkout, webhooks, and portal already live in `billing-payment-lifecycle` and persistence in `billing-domain-persistence`; this change implements them.

### Modified Capabilities

- `billing-payment-lifecycle`: Add explicit requirements for the **HTTP surface** (routes, success/cancel URL contracts), **webhook verification** and **event inventory** (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`), and **feature-flag** behavior when Stripe integration is partially enabled.
- `billing-credit-entitlements`: Add or sharpen requirements for **ledger entry types** and **idempotency keys** when applying `paid_monthly_grant` and `topup_grant` from Stripe (e.g. tie to `stripe_event_id` / invoice id) so support and reconciliation match implementation.

## Impact

- **Backend:** `backend/package.json` (stripe dependency), new or extended services under `backend/src/billing/`, `billing.controller.ts` (new routes + raw body for webhook), `main.ts` or middleware for raw webhook body, `billing.repository.ts` extensions for webhook/checkout persistence already implied by schema.
- **Config:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, existing flags; staging/production secrets (user-operated).
- **Frontend:** Out of scope for this change (hosted Checkout redirect only needs a client to open the returned URL; can be a follow-up or minimal internal test).
- **Supabase:** No migration expected if current `z_billing` schema already matches; confirm any missing columns for webhook metadata if gaps appear during design.
- **Docs:** Optional cross-link from monetization roadmap; user-facing Stripe Dashboard checklists already in `docs/pricing/stripe-dashboard-*.md`.
