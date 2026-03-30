## Context

Monti has already completed pricing research and a recommended launch plan, but the codebase still has no monetization contract.

Today:

- the web app has a session-aware landing page in `web/app/page.tsx`, but no public pricing route, upgrade funnel, or billing settings surface;
- the backend is an authenticated chat runtime with no billing module, no Stripe integration, no ledger, and no webhook handling;
- persistence stops at chat and generation artifacts, with no billing tables or entitlement state; and
- generation and refinement already have a clean successful-artifact boundary through `assistant_runs`, `tool_invocations`, `generation_runs`, and `experience_versions`.

That makes this the right moment to freeze policy before implementation.

This change is intentionally a contract layer, not a payment or runtime implementation change. Its job is to define the stable rules future changes must follow so the implementation sequence can stay narrow:

1. measure usage;
2. add billing data structures;
3. grant and read entitlements;
4. enforce credits in the generation path;
5. connect Stripe;
6. expose pricing and billing UX; and
7. add reconciliation and launch controls.

Stakeholders for this contract are product, billing/ops, backend, frontend, and support. The decisions here need to be stable enough that later OpenSpec changes can implement against them without reopening the core billing model.

## Goals / Non-Goals

**Goals:**

- Define Monti's launch billable unit and the exact settlement boundary for generation and refinement.
- Freeze the launch pricing contract: free allowance, paid allowance, `fast` and `quality` costs, top-up rules, and no-overage launch posture.
- Define the responsibility split between Stripe and Monti.
- Define how public pricing, authentication, checkout, and authenticated billing entry points connect.
- Define deterministic credit bucket ordering, reservation, release, and debit rules.
- Define which external billing events are authoritative and how subscription lifecycle maps to internal entitlements.
- Establish a stable implementation sequence for the next monetization proposals.

**Non-Goals:**

- Implementing Stripe, billing tables, ledger services, or runtime credit enforcement in this change.
- Finalizing every internal table name, API shape, or component structure for later changes.
- Supporting anonymous checkout, annual plans, coupons, seat billing, automatic overages, or usage-based Stripe billing at launch.
- Designing a full internal admin console in this change.
- Locking every future pricing revision beyond the launch contract.

## Decisions

### 1. Bill only at the successful persisted artifact boundary

Monti's launch billable unit is a successful `generate_experience` outcome that persists a new `experience_version`.

This applies to both:

- initial generation; and
- refinement runs that create a new linked version.

The system MUST NOT bill on message submit, assistant turn creation, or raw model invocation count. A request becomes billable only when:

1. the runtime resolves a billable mode (`fast` or `quality`);
2. the system confirms sufficient balance and creates a reservation;
3. the generation flow completes successfully; and
4. the new artifact version is persisted.

If any step after reservation fails, the reservation is released rather than debited.

Why this choice:

- It matches the pricing research and recommendation work.
- It maps cleanly to Monti's existing successful-artifact persistence boundary.
- It avoids charging for hidden retries, tool failures, or dead-end assistant turns.

Alternatives considered:

- Charge on message submit: rejected because one user request can fail, retry, or never produce an artifact.
- Charge per assistant run or per model call: rejected because it exposes implementation detail rather than product value.
- Charge by raw provider cost only: rejected because launch pricing is intentionally user-simple and credit-based.

### 2. Use an internal, versioned credit catalog owned by Monti

Monti will meter internal credits, not raw provider dollars, as the product-facing billing unit.

The launch catalog is:

- free allowance: `15 credits` per monthly free cycle;
- paid allowance: `150 credits` per paid monthly cycle;
- paid plan price anchor: `$10/month`;
- `fast` generation cost: `1 credit`;
- `quality` generation cost: `5 credits`;
- paid-user top-up pack: `50 credits for $4`; and
- automatic overage billing: disabled at launch.

Every billable decision MUST resolve through a versioned internal pricing rule set so historical debits, grants, and public pricing can be reconstructed against the rule version active at the time.

Why this choice:

- User-facing pricing stays stable even if provider routing or token costs move.
- Historical ledger and reconciliation remain interpretable after future pricing changes.
- Frontend copy, entitlement checks, and backend settlement can all point to the same contract.

Alternatives considered:

- Direct dollar billing from provider usage: rejected because it is too volatile and hard to explain.
- Stripe metered billing as the primary entitlement system: rejected because Monti needs internal control over reservations, retries, and successful-artifact settlement.

### 3. Use deterministic credit buckets and consume expiring recurring credits before top-ups

Credits will be stored in explicit internal buckets rather than a single opaque counter.

Launch bucket classes are:

- recurring cycle buckets, created by free-cycle grants or paid subscription-cycle grants; and
- top-up buckets, created by successful top-up purchases.

Recurring buckets expire at the end of their cycle. Top-up buckets are persistent while the user retains an active paid entitlement.

Usable buckets MUST be consumed in this order:

1. recurring buckets ordered by earliest expiration timestamp first;
2. top-up buckets ordered by oldest grant first.

This rule intentionally handles overlap cases such as a user upgrading from free to paid mid-cycle. If both free-cycle and paid-cycle recurring buckets are temporarily present, the earlier-expiring recurring bucket is consumed first.

After a subscription fully lapses:

- recurring paid buckets expire according to their cycle end;
- new top-up purchases are blocked; and
- existing top-up buckets are frozen until the user reactivates a paid subscription.

Why this choice:

- Expiring credits are used before durable credits, which reduces avoidable user loss.
- Top-up credits stay valuable for active subscribers without becoming a perpetual free-tier bypass after cancellation.
- Overlapping grants still have a deterministic, auditable consumption order.

Alternatives considered:

- Consume top-ups first: rejected because it wastes monthly included credits.
- Let top-ups remain permanently usable after lapse: rejected because it weakens the paid plan boundary.
- Collapse all credits into one balance: rejected because it obscures expiry, auditability, and settlement.

### 4. Require authentication before checkout and preserve pricing intent through auth

Launch monetization is account-first.

Users must authenticate with Supabase before Monti creates:

- a subscription checkout session;
- a top-up checkout session; or
- a customer-portal session.

Signed-out visitors may choose a pricing CTA on the public site, but Monti will preserve that pricing intent through sign-in or sign-up and resume the intended billing action after authentication completes.

Monti will lazily create a Stripe customer record on the first billing action that requires one and then reuse that mapping for future sessions.

Why this choice:

- The application is already fully identity-centered on Supabase.
- Authenticated ownership is required for threads, experience history, and entitlements.
- It avoids guest checkout reconciliation, duplicate account linking, and post-purchase identity repair.

Alternatives considered:

- Anonymous pre-auth checkout: rejected as unnecessary launch complexity.
- Creating Stripe customers at sign-up time: rejected because many users will never enter a paid flow.

### 5. Stripe owns money movement; Monti owns entitlements and settlement

Stripe is the payment source of truth. Monti is the entitlement source of truth.

Stripe is authoritative for:

- customer payment methods;
- checkout payment collection;
- invoice collection outcomes;
- subscription status from Stripe's lifecycle; and
- self-service billing management through Stripe Customer Portal.

Monti is authoritative for:

- internal pricing rules;
- credit grants and bucket state;
- reservations, releases, and debits;
- authorization for whether a run may proceed; and
- the user-visible balance and billing interpretation shown inside the product.

Monti MUST NOT treat redirect return pages as authoritative for grants or access changes. Verified Stripe webhooks are the only source allowed to mutate paid billing state.

Why this choice:

- Stripe is good at cash collection and self-service billing.
- Monti must still control product semantics such as retries, successful-run charging, and credit freezes.

Alternatives considered:

- Put all entitlement logic in Stripe: rejected because Stripe does not model Monti's runtime boundary or reservation semantics.
- Use success/cancel routes as grant triggers: rejected because those routes are client-controlled and not reliable for settlement.

### 6. Grant recurring credits on verified cycle events, with no separate Stripe trial at launch

The free plan is the launch onboarding allowance. Monti will not add a separate Stripe trial on top of it.

Free-cycle grants:

- begin when a user first becomes eligible for the launch free plan; and
- renew on a monthly cadence anchored to the timestamp of the user's first free-cycle grant.

Paid-cycle grants:

- begin when the initial subscription payment is verified through Stripe; and
- renew on each verified paid billing cycle event, aligned to Stripe's paid-through period.

At launch, the authoritative trigger for paid-cycle grant creation is a verified successful invoice collection event, not merely checkout completion.

Cancellation behavior:

- cancellation stops future recurring paid grants;
- the user's active paid entitlement remains usable until the Stripe paid-through period ends; and
- top-up buckets remain usable only while the paid entitlement is still active.

Why this choice:

- The free plan already covers the launch "try before paying" need.
- Granting on verified payment keeps Monti's internal state aligned with collected revenue.
- Using Stripe's paid-through period avoids inventing a competing subscription clock.

Alternatives considered:

- Add a Stripe trial on top of the free plan: rejected because it complicates lifecycle rules without adding clear launch value.
- Grant on checkout session completion: rejected because checkout completion does not guarantee collected funds.

### 7. Publish pricing in both the public marketing surface and a dedicated shareable route

Monti will expose pricing in two public places:

- a pricing section on the unauthenticated root landing experience; and
- a dedicated `/pricing` route that can be shared directly.

Authenticated users will also get billing entry points inside the product, including at minimum:

- an upgrade path for free users;
- a billing-management path for paid users; and
- billing-aware messaging when balance is insufficient.

Public pricing content and authenticated billing UI MUST resolve from the same current pricing contract so the marketing story cannot drift from the actual billing behavior.

Why this choice:

- The landing page needs to sell the plan.
- A dedicated pricing route is easier to share, link, and iterate on.
- Authenticated users still need plan context and management without returning to the public site.

Alternatives considered:

- Stripe-hosted pricing page only: rejected because Monti still needs its own product framing and SEO/shareable marketing surface.
- Public pricing route only, with no landing-page pricing: rejected because the main entrypoint already serves marketing content.

### 8. Treat this change as the contract gate for sequential implementation proposals

This change does not try to implement monetization in one step. It freezes the contract that later proposals must follow.

The intended proposal sequence is:

1. `persist-usage-telemetry`
2. `add-billing-domain-foundation`
3. `add-credit-grants-and-entitlements`
4. `enforce-credits-in-generation-runtime`
5. `integrate-stripe-billing`
6. `build-public-pricing-funnel`
7. `build-billing-workspace`
8. `add-billing-ops-and-reconciliation`
9. `launch-monetization`

Why this choice:

- The foundation must be auditable before enforcement.
- Entitlements must exist before Stripe can safely grant into them.
- Public pricing and in-product billing UX should reflect real backend behavior, not speculative state.

Alternatives considered:

- Implement monetization in one change: rejected because it would hide policy assumptions inside code.
- Build Stripe first: rejected because payment collection without internal billing semantics creates rework and risk.

## Risks / Trade-offs

- [Webhook timing can lag behind user navigation] -> Treat success pages as informational only, show pending states where needed, and wait for verified webhook settlement before granting access.
- [Provider routing or model pricing can drift after launch planning] -> Store rule versions internally, keep billing based on the active contract rather than ad hoc provider prices, and rerun pricing research when routing changes materially.
- [Concurrent requests can overspend credits if reservations are not transactional] -> Make reservation locking a hard requirement in the follow-on entitlement implementation before enforcement is enabled.
- [Top-up freezing after lapse can surprise users] -> Explain the rule clearly on pricing and billing surfaces before purchase and in cancellation flows.
- [Free-cycle and paid-cycle overlap increases implementation complexity] -> Use explicit bucket classes and deterministic earliest-expiry ordering rather than plan-specific special cases.
- [Tax, invoicing, and legal posture can block go-live late] -> Treat tax configuration, terms, refund language, and support workflow as external launch prerequisites instead of implicit engineering follow-up.
- [Public pricing copy can drift from real billing behavior] -> Use shared pricing configuration and explicit pricing rule versions across marketing and billing surfaces.

## Migration Plan

1. Merge this contract change and treat it as the monetization policy source of truth for later proposals.
2. Implement usage telemetry first so model-cost measurement exists before billing enforcement.
3. Add the billing domain foundation and entitlement ledger in a non-enforcing state behind feature flags.
4. Integrate Stripe in test mode, verify webhook idempotency and lifecycle mapping, and confirm grant behavior against the contract.
5. Add public pricing and authenticated billing entry points using the shared pricing contract.
6. Enable backend credit enforcement only after reservation, settlement, and reconciliation paths are verified end to end.
7. Launch with feature flags so checkout, grants, and enforcement can be enabled progressively.

Rollback strategy for later implementation phases:

- disable billing enforcement flags so generation falls back to the current non-billing behavior;
- disable checkout and top-up entry points while keeping read-only billing history intact; and
- keep webhook ingestion idempotent so replay/recovery is still possible after a paused rollout.

## Open Questions

- Should Stripe Tax be enabled at launch, or will tax handling be managed manually for the first monetized release?
- Is launch pricing explicitly USD-only in both product copy and Stripe configuration, or does the business want localized currency display later?
- What user-visible refund and billing-support policy should appear in the pricing and billing surfaces at launch?
- Does Monti want a lightweight internal support UI in the first ops phase, or are direct database/admin interventions acceptable for initial launch support?
