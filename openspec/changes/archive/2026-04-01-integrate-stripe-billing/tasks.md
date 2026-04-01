## 1. Dependencies and configuration

- 1.1 Add `stripe` to `backend/package.json` and install; configure Stripe client with secret from `BillingConfigService` (pin API version explicitly).
- 1.2 Extend `BillingConfigService` (and `.env.example`) for any missing settings: success/cancel URL bases for Checkout, optional default portal `return_url`, and document interaction with existing `STRIPE_*` and feature flags.

## 2. Persistence helpers

- 2.1 Extend `BillingRepository` (or dedicated repository) to insert/update `billing_webhook_events` (received → processed/failed), insert `billing_checkout_sessions`, upsert `billing_customers` with `stripe_customer_id`, upsert `billing_subscriptions` from Stripe subscription payloads.
- 2.2 Add idempotent operations for `credit_grants` and `credit_ledger_entries` for `paid_monthly_grant` / `topup_grant` keyed by `stripe_invoice_id`, `stripe_checkout_session_id`, and/or `stripe_event_id` per design.

## 3. Stripe customer and session services

- 3.1 Implement lazy Stripe Customer create-and-persist for a Monti `user_id` (email/metadata from Supabase or JWT claims as available).
- 3.2 Implement `createSubscriptionCheckoutSession` (mode `subscription`, price from `STRIPE_PRICE_ID_PAID_MONTHLY`, customer, success/cancel URLs).
- 3.3 Implement `createTopupCheckoutSession` (mode `payment`, price from `STRIPE_PRICE_ID_TOPUP_50`) gated by active paid entitlement and `TOPUPS_ENABLED`.
- 3.4 Implement `createBillingPortalSession` gated by `BILLING_PORTAL_ENABLED` and existing customer mapping.

## 4. HTTP API (authenticated billing routes)

- 4.1 Add `POST /api/billing/checkout/subscription` and `POST /api/billing/checkout/topup` to `BillingController` with `AuthGuard`, returning `{ url }` (or consistent envelope); enforce `BILLING_ENABLED` and business rules from `billing-payment-lifecycle` (reject top-up if not paid-active).
- 4.2 Add `POST /api/billing/portal` with `AuthGuard`; return portal URL or documented error for free-only users without Stripe customer.

## 5. Webhook pipeline

- 5.1 Enable **raw body** for `POST /api/billing/webhooks/stripe` only (Nest middleware or `rawBody` option) and exclude `AuthGuard` for this route.
- 5.2 Implement signature verification with `constructEvent`; on failure return 400 without side effects.
- 5.3 When `STRIPE_WEBHOOKS_ENABLED` is false, reject webhook processing without applying side effects (document status code in code comments).
- 5.4 Persist event row first (or use unique constraint) to claim idempotency; implement dispatcher for: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- 5.5 Implement handlers per design D3: subscription mirror updates; paid recurring grant from `invoice.paid` with dedupe; top-up grant from completed checkout/payment path with dedupe; map `invoice.payment_failed` to subscription mirror state without granting.

## 6. Automated tests

- 6.1 Unit tests: signature verification (valid/invalid), idempotent duplicate `stripe_event_id`, grant dedupe on repeated `invoice.paid` / same invoice id.
- 6.2 Controller tests: authenticated checkout/portal routes return URLs when mocked Stripe client succeeds; top-up rejected when not eligible.

## 7. Manual QA

**Prerequisites:** Sandbox Stripe products/prices and test API keys configured per `docs/pricing/stripe-dashboard-sandbox-checklist.md`; backend env matches mode (`sk_test_…`, test `price_…` IDs). For local webhooks, `stripe listen --forward-to <backend>/api/billing/webhooks/stripe` running and `STRIPE_WEBHOOK_SECRET` set to the CLI’s `whsec_…` (not the Dashboard endpoint secret unless using a registered URL).

### Environment and safety

- 7.1 With `STRIPE_WEBHOOKS_ENABLED=false`, POST a syntactically valid webhook payload: confirm **no** grants, subscription mirror, or processed `billing_webhook_events` side effects (expected behavior matches implementation: reject or no-op as documented).
- 7.2 POST to `/api/billing/webhooks/stripe` with a **tampered** body or wrong signature: expect **4xx**, no billing mutations.
- 7.3 With `BILLING_ENABLED=false`, authenticated checkout/portal endpoints do not create real Stripe sessions (or return a clear disabled response—match implementation).

### Authenticated API (use a valid Monti JWT)

- 7.4 `GET /api/billing/me` as a **free** user: note `plan`/balances before checkout.
- 7.5 `POST /api/billing/checkout/subscription`: response includes a **Checkout URL**; open in browser, complete payment with test card `4242 4242 4242 4242` (or current [Stripe testing](https://docs.stripe.com/testing) equivalent).
- 7.6 After Checkout completes, **before** assuming UI updated: confirm `**billing_webhook_events`** rows in Supabase for relevant types (`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, etc.) and **2xx** delivery in Stripe CLI or Dashboard → Webhooks.
- 7.7 Confirm `**billing_customers`** has `stripe_customer_id` for the test user; `**billing_subscriptions**` reflects an active subscription with plausible period fields.
- 7.8 Confirm `**credit_grants**` includes a new **paid recurring** bucket for the period (amounts match launch pricing / seeded snapshot); `**credit_ledger_entries`** includes `**paid_monthly_grant**` with `stripe_event_id` populated where applicable.
- 7.9 `GET /api/billing/me`: **paid** plan context, non-zero included credits (or expected bucket breakdown), subscription period end if exposed.
- 7.10 `**TOPUPS_ENABLED` true**, same user: `POST /api/billing/checkout/topup` returns URL; complete Checkout; confirm **top-up** grant + `**topup_grant`** ledger row **once**; balances increase accordingly.
- 7.11 `**TOPUPS_ENABLED` true**, **free** user (no active paid): `POST /api/billing/checkout/topup` returns **4xx** (or documented error) and no top-up Checkout session is usable for entitlement.
- 7.12 `**BILLING_PORTAL_ENABLED` true**, paid user: `POST /api/billing/portal` returns portal URL; open it, confirm Stripe portal loads for the same customer; return URL lands on configured app URL.
- 7.13 Free user **without** Stripe customer: `POST /api/billing/portal` does not return a broken portal link (error or upgrade path per spec).

### Idempotency and retries

- 7.14 From Stripe Dashboard (or CLI), **resend** the same event: no duplicate grants, no duplicate ledger rows for the same invoice/session id, `billing_webhook_events` shows idempotent handling.
- 7.15 If feasible, trigger overlapping events (e.g. checkout completed + invoice paid) and confirm **at most one** paid-cycle grant for the same billing period per design.

### Subscription lifecycle (sandbox)

- 7.16 In **Customer portal** (or Dashboard), **cancel at period end**; confirm `customer.subscription.updated` updates mirror (`cancel_at_period_end`, etc.) and user remains paid through period end on `GET /api/billing/me`.
- 7.17 After paid-through period ends (or use [test clocks](https://docs.stripe.com/billing/testing) if you use them), confirm paid entitlement lapses, **top-up** checkout is blocked, and top-up buckets are frozen per `billing-credit-entitlements` (spot-check `GET /api/billing/me`).

### Payment failure (optional if testable in sandbox)

- 7.18 Use a [decline test card](https://docs.stripe.com/testing#declined-payments) or Stripe tooling to force `**invoice.payment_failed`**: confirm no erroneous grant; subscription mirror or status reflects failure handling per implementation.

### Runtime integration

- 7.19 With `BILLING_ENABLED` + `CREDIT_ENFORCEMENT_ENABLED` as in staging policy, run a `**generate_experience**` after grants exist: reservation/settle still behaves correctly (no double debit; insufficient credits still blocked when balance too low).

### Production readiness (when applicable)

- 7.20 Repeat critical paths (**7.5–7.12** subset) in **live mode** with live keys, live price IDs, and a **live** webhook endpoint URL; use a **small real** charge only if intentional; otherwise validate configuration only and rely on sandbox for destructive tests.

