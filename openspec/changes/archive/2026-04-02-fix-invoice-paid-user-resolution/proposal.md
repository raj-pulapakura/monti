## Why

`handleInvoicePaid` resolves the Monti user exclusively via `billing_customers.stripe_customer_id`, but Stripe does not guarantee that `invoice.paid` arrives after `checkout.session.completed`. When the invoice event wins the race, the customer mapping may not exist yet and the handler silently drops the event — leaving a paid subscriber with no credits and no retry path since the event is marked `processed`.

## What Changes

- `handleInvoicePaid` gains a fallback user-resolution path: when `findUserIdByStripeCustomerId` returns null, the handler reads `monti_user_id` from the subscription's Stripe metadata and repairs the `billing_customers` mapping before continuing
- `handleCheckoutSessionEvent` upserts `billing_customers.stripe_customer_id` from the session's customer field so whichever event arrives first establishes the mapping
- The `billing-payment-lifecycle` spec gains a scenario covering webhook event-ordering resilience for the initial subscription payment

## Capabilities

### New Capabilities

_None — this is a hardening fix to an existing capability._

### Modified Capabilities

- `billing-payment-lifecycle`: add requirement/scenario — `invoice.paid` MUST resolve the Monti user via subscription metadata fallback when the `billing_customers` customer mapping is not yet present, and MUST repair the mapping before completing grant creation

## Impact

- `backend/src/billing/stripe-webhook.service.ts` — `handleInvoicePaid`, `handleCheckoutSessionEvent`
- `backend/src/billing/stripe-webhook.types.ts` — extend `InvoiceLike` / `CheckoutSessionLike` if needed for customer field access
- `backend/src/billing/stripe-webhook.service.spec.ts` — new test cases for ordering scenarios
- `openspec/specs/billing-payment-lifecycle/spec.md` — delta scenario
