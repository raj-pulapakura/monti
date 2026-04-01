## Context

Monti’s backend already has `BillingModule`, `billing_customers`, `billing_subscriptions`, `billing_checkout_sessions`, `billing_webhook_events`, `credit_grants`, append-only `credit_ledger_entries`, and `GET /api/billing/me`. Credit reservation/settlement is wired to `generate_experience` when flags allow. **Stripe is not integrated:** no `stripe` package, no Checkout or Portal session creation, no webhook controller.

The monetization contract in `billing-payment-lifecycle` and `billing-credit-entitlements` already states that **verified webhooks** authorize grants and that **success/cancel redirects are not authoritative**. This design implements that contract using **Stripe-hosted Checkout** and **Billing Portal**, consistent with `docs/pricing/monetization-roadmap.md` Proposal 5.

## Goals / Non-Goals

**Goals:**

- Lazy-create **Stripe Customer** per Monti user on first billing action; persist `stripe_customer_id` on `billing_customers`.
- **Subscription Checkout** and **top-up Checkout** (one-time) using env-configured **Price IDs**; return `url` for browser redirect.
- **Billing Portal** session creation for users with a Stripe customer mapping; safe behavior for free-only users per spec.
- **Webhook endpoint** with signature verification, append-only event receipt in `billing_webhook_events`, **idempotent** processing keyed by Stripe event id.
- Sync **`billing_subscriptions`** from `customer.subscription.updated` / `customer.subscription.deleted` (and initial subscription context from checkout completion where needed).
- Create **paid recurring** and **top-up** grants from the correct **financial events** (per spec: invoice paid for cycle grants; top-up when payment confirmed—design aligns with roadmap: avoid granting on redirect alone; use `invoice.paid` / `checkout.session.completed` with care to avoid double grant—see Decisions).
- Wire **NestJS** so `/api/billing/webhooks/stripe` receives **raw body** for `stripe.webhooks.constructEvent`.

**Non-Goals:**

- **Frontend** pricing UI, success/cancel pages, or Next.js calls (Proposal 6/7); may use manual/API testing only.
- **Stripe Elements** or **embedded Checkout** on Monti domains.
- **Automatic tax**, **coupons**, **trials**, **multiple paid tiers**, **proration** beyond what default Stripe behavior provides—explicitly deferred unless Open Questions resolve otherwise.
- **Admin/support UI** for manual grants (separate roadmap item).
- **Changing** Supabase RLS or adding user-facing direct Stripe table access.

## Decisions

### D1: Stripe Node SDK and API version

- **Choice:** Add official `stripe` npm package; pin Stripe **API version** explicitly via SDK constructor options or Stripe dashboard default, consistent with [Stripe versioning](https://docs.stripe.com/sdks).
- **Rationale:** Battle-tested signing, retries, and type shapes; matches roadmap.
- **Alternative:** Raw `fetch` to Stripe API—rejected (more error-prone, no built-in idempotency helpers).

### D2: Webhook raw body in Nest

- **Choice:** Use Nest `rawBody: true` globally **or** a dedicated middleware/route that preserves raw bytes **only** for the webhook path; pass raw body into `stripe.webhooks.constructEvent`.
- **Rationale:** Signature verification requires unmodified body; JSON parser breaks verification.
- **Alternative:** Separate microservice for webhooks—rejected for launch footprint.

### D3: Grant authority and double-grant prevention

- **Choice:** Treat **`invoice.paid`** as the **primary authority** for **paid monthly recurring grant** for a subscription billing period (matches existing `billing-payment-lifecycle` scenario). Use **`checkout.session.completed`** (and **`checkout.session.async_payment_succeeded`** where needed) to **link** checkout to customer/subscription and for **one-time top-up** line items, but ensure **idempotency** so that if both `checkout.session.completed` and `invoice.paid` fire for overlapping semantics, **at most one grant** is created per intended business event (e.g. dedupe by `stripe_invoice_id` on `credit_grants` and/or unique ledger correlation).
- **Rationale:** Roadmap lists both checkout and invoice events; invoice is the standard subscription “money collected” signal.
- **Alternative:** Grant only on `checkout.session.completed`—rejected for renewals (renewals are invoice-driven).

### D4: Checkout session persistence

- **Choice:** Insert `billing_checkout_sessions` when Monti creates a session, with `mode`, `intent` (`subscription` | `topup`), `user_id`, `stripe_checkout_session_id`.
- **Rationale:** Audit and support; already in `billing-domain-persistence`.

### D5: Webhook processing status

- **Choice:** Insert `billing_webhook_events` with `processing_status` transitions: received → processing → processed | failed; on duplicate `stripe_event_id`, short-circuit to idempotent no-op.
- **Rationale:** Matches schema intent and supports replay investigation.

### D6: Feature flags

- **Choice:** If `STRIPE_WEBHOOKS_ENABLED` is false, webhook route returns **503** or **404** (pick one consistently) and does not mutate billing state; Checkout/Portal endpoints require `BILLING_ENABLED` true and valid `STRIPE_SECRET_KEY`; `BILLING_PORTAL_ENABLED` gates portal route; `TOPUPS_ENABLED` gates top-up checkout.
- **Rationale:** Safe incremental rollout documented in `.env.example`.

### D7: Customer Portal `return_url`

- **Choice:** Pass configurable `return_url` from request body or env default (`FRONTEND_URL` / `NEXT_PUBLIC_APP_URL` pattern)—exact shape in tasks; must be HTTPS in production.

### D8: Auth on routes

- **Choice:** Checkout and Portal routes use existing **JWT auth guard**; webhook route is **unauthenticated** but signature-verified.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Double grants on overlapping events | Dedupe keys on grants/ledger (`stripe_invoice_id`, `stripe_checkout_session_id`, `stripe_event_id`); single transaction per event handler |
| Webhook delivery failures delay access | UI shows “processing”; retries are Stripe’s; monitor Dashboard + `billing_webhook_events.failed` |
| Raw body breaks other routes | Scope raw parsing to webhook path only if global rawBody is risky |
| Live vs test key mismatch | Document env per environment; CI uses mocks |
| Subscription mirror drift | Prefer retrieving latest subscription from Stripe API inside handlers when payload is thin (optional optimization in tasks) |

## Migration Plan

1. Land code behind flags **off** in production (`STRIPE_WEBHOOKS_ENABLED=false`).
2. Deploy; configure staging with test keys; run Stripe CLI `listen` locally.
3. Enable webhooks on staging; run end-to-end test checkout and renewal simulation ([test clocks](https://docs.stripe.com/billing/testing)).
4. Production: register live webhook URL; enable flags; smoke test with real card optional.

**Rollback:** Disable `STRIPE_WEBHOOKS_ENABLED` and Checkout routes; Stripe stops mutating Monti state; existing grants remain; support handles edge cases manually.

## Open Questions

- Exact **success/cancel** URL domains until Proposal 6 lands (use placeholder env vars).
- Whether **first** paid period also emits scenarios where `invoice.paid` is delayed vs `checkout.session.completed`—confirm handler ordering in implementation tests.
- **Payment failed** UX: spec requires processing `invoice.payment_failed`; decide internal `billing_subscriptions.status` mapping and whether user notifications are in scope (likely non-goal).
