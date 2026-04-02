## Context

When a user completes a Stripe subscription checkout, Stripe fires both `invoice.paid` and `checkout.session.completed`. The system relies on `billing_customers.stripe_customer_id` being present to resolve the Monti user in `handleInvoicePaid`. This mapping is written during checkout session creation (before the user even reaches Stripe), but Stripe webhook delivery ordering is not guaranteed. When `invoice.paid` arrives first and the mapping lookup returns null, the handler silently returns — the event is marked `processed` with no error and no retry, and the paid grant is never created.

The subscription mirror is unaffected because `handleCheckoutSessionEvent` resolves userId from `session.client_reference_id` rather than the customer mapping. This explains why `/me` can show `plan: paid` (subscription synced) while credits remain at 15 (free grant only).

A secondary exposure: `handleCheckoutSessionEvent` does not write `billing_customers.stripe_customer_id` from the session's customer field, so even if checkout processes first it provides no insurance for later invoice events.

## Goals / Non-Goals

**Goals:**
- `handleInvoicePaid` resolves the Monti user even when `billing_customers.stripe_customer_id` is null at arrival time
- Whichever of `invoice.paid` / `checkout.session.completed` arrives first establishes the customer mapping
- No new infrastructure dependencies; fix is entirely within the existing webhook service

**Non-Goals:**
- Handling event reordering for `invoice.payment_failed` or `handleSubscriptionLifecycle` — these don't create grants and the silent-drop is lower risk; can be addressed separately
- Retry queue or async deferral infrastructure
- Changes to the checkout or entitlement services

## Decisions

### Decision: Resolve user from subscription metadata as fallback

When `findUserIdByStripeCustomerId` returns null in `handleInvoicePaid`, the handler already retrieves the subscription from Stripe to get period dates. Stripe subscriptions have `metadata.monti_user_id` set at creation time (`createSubscriptionCheckoutSession` sets it in `subscription_data.metadata`). This is always present and is the authoritative source for the user mapping.

Fallback path: retrieve subscription → read `metadata.monti_user_id` → upsert `billing_customers` row with the now-known `stripe_customer_id` → continue with grant creation.

Alternatives considered: (1) throw and force Stripe retry — brittle because `checkout.session.completed` may arrive after the retry window and the event would end up in `failed` state requiring manual replay. (2) Defer processing with a sleep/queue — adds infrastructure complexity for a race that is resolvable in-band.

### Decision: `handleCheckoutSessionEvent` upserts `billing_customers.stripe_customer_id`

The checkout session payload contains the `customer` field (the Stripe customer ID). When processing a subscription-mode checkout session, the handler already has the userId from `client_reference_id`. Writing `stripe_customer_id` here means the mapping is established by whichever event arrives first, providing belt-and-suspenders coverage.

This requires adding `customer` to `CheckoutSessionLike` and a new `upsertBillingCustomerStripeId` repository method (or reuse of the existing update with an ensure-row guard).

### Decision: Move subscription retrieval before the user-lookup fallback

Currently `handleInvoicePaid` retrieves the subscription after establishing userId. To use subscription metadata as fallback, the retrieval must happen earlier (or be structured as: try customer lookup → if null, retrieve subscription + read metadata → upsert mapping → continue). The subscription is retrieved unconditionally either way, so there is no extra Stripe API call in the happy path.

## Risks / Trade-offs

- **Subscription metadata missing**: If `monti_user_id` is absent from subscription metadata (e.g., a subscription created outside the app), the handler still returns early but now with a more informative log. No regression from current behavior. → Mitigation: log at warn with both customerId and subscriptionId.
- **`ensureBillingCustomerRow` + `updateBillingCustomerStripeId` vs a single upsert**: Two calls instead of one introduces a TOCTOU window. Already present in `ensureStripeCustomer`; acceptable given the unique constraint on `user_id`. → Mitigation: `ensureBillingCustomerRow` already handles the unique-violation retry case.
- **Extra Stripe API call on first subscription invoice**: The fallback path retrieves the subscription early. This is only hit when the customer mapping is missing, which in steady state (post-launch) is never. No performance concern in practice.
