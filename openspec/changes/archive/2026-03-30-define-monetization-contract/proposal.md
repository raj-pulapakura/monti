## Why

Monti now has a pricing recommendation, but it does not yet have an implementation-grade monetization contract. Before building telemetry, Stripe flows, credits, or paywalls, the project needs a stable policy layer that defines exactly what is billable, how credits are granted and consumed, what Stripe owns versus what Monti owns, and how the public pricing funnel connects to the authenticated product.

## What Changes

- Add a monetization contract change that formalizes Monti's launch billing model before runtime or payment implementation begins.
- Define the account-first checkout policy, including how signed-out pricing intent resumes after authentication.
- Define the launch credit model for free allowance, paid monthly allowance, `fast` / `quality` credit weights, top-ups, and credit bucket consumption order.
- Define the successful-run settlement policy, including reservation, release, and debit behavior for generate/refine flows.
- Define the Stripe integration contract for subscriptions, top-ups, customer portal access, webhook authority, and internal entitlement synchronization.
- Define the customer-visible pricing surface requirements for the unauthenticated landing page, a shareable pricing route, and authenticated billing entry points.
- Define launch-scope boundaries and deferred areas so later implementation changes do not reopen core monetization decisions.

## Capabilities

### New Capabilities
- `billing-credit-entitlements`: Defines Monti's internal credit model, including plan allowances, grants, reservations, debits, bucket ordering, and entitlement reads.
- `billing-payment-lifecycle`: Defines how Stripe Checkout, Stripe Customer Portal, and Stripe webhooks map to Monti billing state and credit grants.
- `public-pricing-funnel`: Defines the public pricing experience, pricing-intent handoff through auth, and the entry points into paid conversion.

### Modified Capabilities
- `experience-generation`: Successful generate flows now participate in the monetization contract and must settle credits only on successful persisted outcomes.
- `experience-refinement`: Successful refine flows now participate in the same monetization contract and must follow the same successful-run debit rules as generate flows.

## Impact

- New OpenSpec artifacts for monetization policy, billing capabilities, and pricing-surface behavior.
- Future backend impact across the current NestJS runtime, especially `backend/src/chat-runtime/`, `backend/src/experience/`, `backend/src/llm/`, and new billing modules.
- Future web impact across `web/app/page.tsx`, new pricing/billing routes, auth handoff logic, and chat/home billing UX.
- Future Supabase impact through new billing tables, ledger entities, entitlement state, and additional monetization-oriented telemetry.
- External systems affected include Stripe, Railway environment configuration, and production billing/support operations.
