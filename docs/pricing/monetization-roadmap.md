# Monetization Implementation Roadmap

Last updated: 2026-03-30

## Purpose

This document turns Monti's pricing strategy into an implementation roadmap that can be split into sequential OpenSpec proposals.

It is intentionally more detailed than a normal product roadmap. The goal is to remove ambiguity before implementation starts, so each future proposal can be tightly scoped, ordered correctly, and anchored to the current codebase.

This roadmap covers:

- the current application snapshot;
- the desired end state;
- the architectural decisions that should stay stable during implementation;
- the proposal sequence for shipping monetization safely;
- the external setup work outside the repo; and
- the launch criteria for a production-ready pricing experience.

## Current Codebase Snapshot

### Product shape today

Monti is currently a chat-first authenticated studio for creating interactive learning experiences.

- Unauthenticated users land on `/` and see a simple marketing landing surface in `web/app/page.tsx`.
- Authenticated users also land on `/`, but the page swaps into a workspace home that creates chat threads and lists recent creations.
- The main product flow is thread-based creation and refinement in `web/app/chat/[threadId]/page.tsx`.
- All backend runtime APIs live behind authenticated `/api/chat/*` endpoints in `backend/src/chat-runtime/chat-runtime.controller.ts`.

### Web application today

Relevant surfaces:

- `web/app/page.tsx`
  - currently combines marketing landing and authenticated home workspace;
  - has no pricing section, no pricing route, no upgrade CTA, and no billing concepts.
- `web/app/auth/sign-up/page.tsx`
  - supports email/password and OAuth sign-up via Supabase.
- `web/app/auth/sign-in/page.tsx`
  - supports email/password and OAuth sign-in.
- `web/app/chat/[threadId]/page.tsx`
  - runs the main prompt/creation workflow;
  - has no balance display, no paywall state, and no billing-aware UX.
- `web/app/components/floating-profile-controls.tsx`
  - exposes only sign-out, no settings or billing navigation.

Current frontend dependencies:

- Next.js 16
- React 19
- Supabase SSR/browser auth
- no Stripe SDKs
- no analytics vendor
- no billing UI library

### Backend today

The backend is still a focused chat runtime service.

- `backend/src/app.module.ts` imports only `ChatRuntimeModule`.
- `backend/src/chat-runtime/chat-runtime.module.ts` wires auth, Supabase, LLM routing, and experience generation.
- `backend/src/chat-runtime/services/chat-runtime.service.ts` creates threads, submits messages, hydrates thread state, and starts the conversation loop.
- `backend/src/chat-runtime/tools/generate-experience-tool.service.ts` selects a route, calls the experience orchestrator, and maps success back to a persisted experience version.
- `backend/src/experience/services/experience-orchestrator.service.ts` runs generation/refinement and handles automatic retry on token-limit failures.
- `backend/src/persistence/services/experience-persistence.repository.ts` persists `generation_runs` and `experience_versions`.

Important constraints from the current architecture:

- All chat endpoints require a Supabase bearer token.
- There is no public backend controller for checkout, pricing, or billing.
- There is no billing module, no ledger service, no webhook controller, and no Stripe integration.
- There is no admin surface.

### Persistence today

The current Supabase schema is generation-centric, not billing-centric.

Existing relevant tables:

- `chat_threads`
- `chat_messages`
- `assistant_runs`
- `tool_invocations`
- `generation_runs`
- `experience_versions`
- `sandbox_states`

Important existing traits:

- `assistant_runs`, `tool_invocations`, `generation_runs`, and `experience_versions` already give Monti a solid billing boundary for successful artifact generation.
- usage telemetry is now persisted at the main runtime boundaries:
  - `experience_versions.tokens_in` / `tokens_out` for the successful artifact-producing attempt when observed;
  - `generation_runs.attempt_count` plus request-level token totals when every attempt in the request exposed observed usage;
  - `assistant_runs.conversation_tokens_in` / `conversation_tokens_out` across completed rounds when every round exposed observed usage; and
  - `tool_invocations.router_*` for auto-routed `generate_experience` executions.
- `assistant_runs.provider_response_raw` still stores only the latest completed conversation-model raw trace, so per-round trace history remains limited even though normalized totals are now queryable.
- There are no billing tables for customers, subscriptions, credits, grants, entitlements, or webhook events.

### Auth and identity today

- Identity is fully centered on Supabase auth.
- Backend authorization is based on verified Supabase JWTs in `backend/src/auth/auth.guard.ts` and `backend/src/auth/auth-jwt-verifier.service.ts`.
- The application has no separate billing identity model yet.

Implication:

- Any monetization system should attach to authenticated Supabase users.
- Launching an account-first billing flow is much simpler than allowing anonymous or pre-auth purchases.

### Deployment and runtime operations today

Deployment is documented for Railway plus Supabase in `docs/railway-deployment.md`.

Important realities:

- Backend is public and already suitable for receiving webhook traffic.
- Frontend uses browser-side API calls to the backend.
- Environment variables currently cover provider keys and Supabase only.
- There are no billing feature flags yet.

### Pricing/planning work already completed

Monti now has pricing planning artifacts in:

- `docs/pricing/provider-pricing-research.md`
- `docs/pricing/cost-estimation-method.md`
- `docs/pricing/plan-recommendation.md`

Those docs establish:

- free allowance: `15 credits / month`
- paid monthly allowance: `150 credits / month`
- `fast = 1 credit`
- `quality = 5 credits`
- top-up pack: `50 credits for $4`
- launch anchor: `$10 / month`
- billable unit: successful `generate_experience` / persisted artifact
- no automatic overage billing at launch

### What is missing today

Everything below is currently absent:

- public pricing page
- authenticated billing page
- Stripe integration
- billing env vars
- checkout success/cancel routes
- customer portal integration
- billing tables
- credits ledger
- credit reservations
- entitlement checks
- hard billing enforcement in the generation path
- webhook processing
- billing support/admin tooling
- billing analytics and reconciliation

## Goal: Where We Want To Be

Monti should end up with a production-ready monetization system that feels coherent from first visit through renewal and support.

### Target product experience

For signed-out visitors:

- they can see a real pricing story on the public site;
- they understand the difference between `fast` and `quality`;
- they can compare free vs paid allowances;
- they can start the upgrade flow from the public pricing page;
- if they are not authenticated, the app guides them through auth first and resumes the intended purchase flow afterward.

For signed-in users:

- they can always see their plan and remaining credits;
- they know what a `fast` or `quality` action will cost;
- they can subscribe, manage billing, cancel, reactivate, and buy top-ups;
- they are blocked cleanly when they do not have sufficient balance;
- they are never charged for failures, timeouts, or system-deduplicated replays;
- they can see past credit activity and plan state.

For the runtime:

- every successful artifact outcome can be debited cleanly and exactly once;
- balance checks are enforced on the backend;
- retries, duplicate events, and webhook replays do not double-charge users;
- billing state is auditable from source events.

For operations:

- Stripe is the cash-collection system;
- Monti is the usage-entitlement system;
- webhook failures are visible and recoverable;
- support can grant credits, investigate issues, and correct mistakes;
- leadership can compare credits consumed against actual model cost.

## Foundational Decisions To Keep Fixed

These decisions should remain stable unless there is an intentional roadmap reset.

### 1. Use an account-first purchase flow for launch

Recommendation:

- Users must have a Supabase account before Monti creates a subscription or top-up purchase.
- The public pricing page can market the plan and collect intent, but the actual checkout initiation should happen after auth.

Why:

- The product is already auth-centric.
- All generation state is tied to authenticated users.
- It avoids the complexity of guest checkout reconciliation, duplicate accounts, and post-purchase identity matching.

Implication for UX:

- Signed-out CTA flow:
  - choose plan on public pricing page;
  - go to sign-up/sign-in with that pricing intent preserved;
  - resume checkout after auth.

### 2. Use Stripe-hosted Checkout and Stripe Customer Portal for launch

Recommendation:

- Use Stripe Checkout for paid plan signup and top-up purchases.
- Use Stripe Customer Portal for subscription management, invoices, payment methods, and cancellation.

Why:

- It minimizes custom billing UI surface area.
- It reduces PCI and lifecycle complexity.
- It fits Monti's current small backend and ops footprint.

Launch note:

- A custom marketing pricing page is still required on Monti's public site.
- Stripe should handle payment collection and subscription self-service, not pricing-page presentation.

### 3. Keep Stripe as payment source of truth and Monti as entitlement source of truth

Recommendation:

- Stripe decides whether money was collected and what the subscription state is.
- Monti decides what credits the user currently has and whether a specific run may proceed.

Implication:

- Never model credits purely inside Stripe.
- Never use redirect return pages as the authority for access or grants.
- Use verified webhooks plus internal state transitions.

### 4. Bill at the successful artifact boundary, not at message submit

Recommendation:

- Credits are consumed only when a `generate_experience` run succeeds and produces a persisted artifact.

Implication:

- Hard enforcement happens at the tool boundary in `GenerateExperienceToolService`, after route selection but before generation begins.
- Frontend gating can happen earlier, but the backend remains authoritative.

### 5. Keep internal credits separate from provider token telemetry

Recommendation:

- Provider token telemetry exists for internal economics and analysis.
- Customer pricing remains credit-based and simple.

Implication:

- Do not expose per-token billing to users.
- Do store token telemetry so the credit model can be recalibrated later.

### 6. Keep dormant provider configs, but do not price against them until routing changes

Recommendation:

- Gemini remains the active default generation route.
- OpenAI and Anthropic configs may remain in the runtime as dormant alternatives.
- Pricing and entitlement math should use active routes only until real traffic moves.

### 7. Version pricing rules internally

Recommendation:

- Store internal pricing rule versions or snapshots whenever a debit or grant happens.

Why:

- If Monti changes credit weights or plan allowances later, historical entries must remain explainable.

## Recommended End-State Architecture

```text
SIGNED-OUT USER
    |
    v
Public Landing / Pricing
    |
    | pricing intent handoff
    v
Auth (Supabase)
    |
    v
Authenticated Billing API -----------------------> Stripe Checkout
    |                                                  |
    | create session                                   | payment / subscription
    |                                                  v
    |<------------------------------ verified webhooks from Stripe
    |
    v
Billing Module
    |
    +--> billing_customers / subscriptions / webhook_events
    +--> credit grants / reservations / ledger / balances
    +--> entitlement state
    |
    v
Chat Runtime / Generate Experience
    |
    | reserve credits based on actual tier
    | run generation
    | settle on success / release on failure
    v
experience_versions + generation telemetry
```

## External Prerequisites And Non-Repo Setup

These are required for a real launch and should be planned explicitly.

### Stripe account and dashboard setup

Owner: you

Required:

- create or use the Stripe account that will own Monti billing;
- complete business verification and payout setup;
- configure business name, branding, support URL/email, and statement descriptor;
- create a sandbox and live mode setup;
- create the Stripe product catalog for:
  - paid monthly plan
  - top-up pack
- configure Customer Portal settings;
- decide whether Stripe Tax is enabled before live launch;
- decide invoice and receipt email behavior in Stripe;
- configure webhook endpoints for staging and production;
- preserve sandbox and live price IDs separately.

Recommended Stripe docs:

- [Subscriptions via Checkout](https://docs.stripe.com/payments/subscriptions)
- [Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Customer Portal](https://docs.stripe.com/billing/subscriptions/customer-portal)
- [Billing testing and test clocks](https://docs.stripe.com/billing/testing)

### Local development tooling

Owner: you, with Codex guidance

Required:

- install Stripe CLI for local webhook forwarding and fixture testing;
- ensure local frontend and backend URLs are stable during checkout testing;
- maintain separate sandbox keys from live keys.

### Infrastructure and environment variables

Owner: you

Required future backend env vars:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PAID_MONTHLY`
- `STRIPE_PRICE_ID_TOPUP_50`
- `BILLING_ENABLED`
- `CREDIT_ENFORCEMENT_ENABLED`
- `STRIPE_WEBHOOKS_ENABLED`
- `BILLING_PORTAL_ENABLED`
- `FREE_CREDIT_GRANTS_ENABLED`
- `TOPUPS_ENABLED`

Possible web env vars:

- `NEXT_PUBLIC_APP_URL` if the app needs an explicit canonical URL for redirects
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` only if launch UX later uses client Stripe components; not required for a simple server-created hosted Checkout redirect

### Legal, policy, and finance decisions

Owner: you

Must be settled before live launch:

- refund policy
- cancellation policy wording
- treatment of top-up credits after subscription cancellation
- tax handling approach
- terms/privacy updates for paid subscriptions and stored billing data
- support channel for billing disputes and customer questions

### Pricing copy and customer communication

Owner: you, with Codex implementation support

Needed:

- public pricing copy
- FAQ copy for credits, failures, resets, top-ups, and cancellation
- in-product upsell copy
- support macros/runbooks for common billing issues

## Recommended Data Model Additions

This is not the exact final schema, but it is the right conceptual shape.

| Entity | Purpose | Notes |
| --- | --- | --- |
| `billing_customers` | Maps Supabase users to Stripe customers | Create lazily on first billing action |
| `billing_subscriptions` | Internal mirror of Stripe subscription state | Needed for entitlement decisions and auditability |
| `billing_checkout_sessions` | Tracks initiated checkout flows | Useful for debugging and funnel analytics |
| `billing_webhook_events` | Stores Stripe event receipt and processing state | Required for idempotency and replay |
| `credit_grants` | Represents allowance/top-up/manual credit grants | Carries source, amount, cycle, and expiry |
| `credit_ledger_entries` | Immutable source of balance changes | Use as the audit trail |
| `credit_reservations` | Prevents overspend during in-flight generation | Needed for concurrent runtime safety |
| `pricing_rule_snapshots` | Captures the pricing rules used at debit time | Makes historical billing explainable |
| optional balance view/materialization | Fast reads for current available balance | Derived from grants, debits, expirations, and reservations |

### Ledger design guidance

The ledger should be the source of truth, not a mutable balance number alone.

At minimum, entry types should support:

- free monthly grant
- paid monthly grant
- top-up grant
- manual support grant
- reservation created
- reservation released
- successful debit
- manual credit refund
- expiration

### Credit bucket rules

Monti should explicitly distinguish:

- included monthly credits
- purchased top-up credits
- manual/promo credits

Consumption order should be intentional and documented. Recommendation for launch:

1. consume included monthly credits first
2. consume top-up credits second
3. consume promo/manual credits last unless business wants promos burned before paid credits

## Implementation Principles For Runtime Safety

### Hard gate vs soft gate

Monti should use both:

- soft gate in the UI
  - warn before users try to generate without enough balance;
  - display current credit costs near the generation-mode control;
  - surface upgrade/top-up flows early.
- hard gate in the backend
  - enforce at tool execution time before generation actually begins.

### Reservation before generation

Recommended launch flow:

1. route is selected
2. Monti determines the actual credit cost (`1` or `5`)
3. Monti creates a credit reservation
4. generation runs
5. if success: reservation becomes a settled debit
6. if failure/cancel/refusal/dedup: reservation is released

This is the safest way to preserve the "charge only on success" policy while still handling concurrent use.

### Settlement anchor

The final debit should be tied to a concrete runtime success object, ideally:

- `tool_invocation_id`
- and/or `experience_version_id`

This prevents ambiguous billing and makes audits tractable.

### Stripe event source of truth

Use verified webhooks for entitlement-changing Stripe events.

Recommendation:

- subscription grant authority:
  - `invoice.paid`
  - plus `customer.subscription.updated` / `customer.subscription.deleted` for state changes
- top-up grant authority:
  - grant when Stripe confirms payment success, not merely when the browser returns from Checkout
- never use `success_url` pages alone to grant credits

## Recommended Proposal Sequence

The sections below are the suggested sequential OpenSpec implementation changes.

### Proposal 0: Monetization Contract Freeze

Suggested change name: `define-monetization-contract`

Goal:

- convert the roadmap and pricing decisions into implementation-grade rules before touching runtime billing.

What this proposal should settle:

- final account-first purchase flow
- exact credit bucket consumption order
- free-cycle anchor rule
- paid-cycle grant rule
- top-up post-cancel behavior
- whether launch uses Stripe Tax
- whether launch uses free credits only or also offers an optional Stripe trial
- feature-flag plan
- internal plan keys and pricing rule versioning scheme

Why this exists:

- It is cheaper to settle policy before ledger and webhook code exist.

Exit criteria:

- there is one clear monetization contract doc or design artifact that later proposals can implement without re-litigating core rules.

### Proposal 1: Persist Usage Telemetry

Suggested change name: `persist-usage-telemetry`

Status:

- archived on 2026-03-30

Goal:

- make internal cost measurement real before customer billing launches.

Primary deliverables:

- extend provider result contracts to include normalized usage;
- persist generation token usage into `generation_runs` and `experience_versions`;
- normalize conversation and router usage where feasible;
- persist `attempt_count` plus retry-aware request totals on `generation_runs`.

Likely backend touchpoints:

- `backend/src/llm/llm.types.ts`
- `backend/src/llm/providers/*.ts`
- `backend/src/llm/llm-router.service.ts`
- `backend/src/experience/services/experience-orchestrator.service.ts`
- `backend/src/persistence/services/experience-persistence.repository.ts`
- Supabase schema/migrations for any additional usage columns

Must include:

- tests for provider usage normalization
- tests for persistence writes
- documentation updates to pricing/method docs if the storage shape changes

Exit criteria:

- successful runs persist normalized generation token usage;
- telemetry can distinguish observed from estimated cost for generation;
- internal cost dashboards become possible.

### Proposal 2: Billing Domain Foundation

Suggested change name: `add-billing-domain-foundation`

Status:

- archived on 2026-03-31

Goal:

- create the application's billing domain model without yet enforcing it in the runtime.

Primary deliverables:

- new `BillingModule` in the backend;
- schema for billing customers, subscriptions, checkout sessions, webhook events, credit grants, credit reservations, ledger entries, and pricing snapshots;
- internal plan catalog and configuration layer;
- billing feature flags and environment variables;
- repository/service scaffolding for billing reads/writes.

Recommended backend additions:

- `backend/src/billing/billing.module.ts`
- `billing-config.service.ts`
- `billing.repository.ts`
- `credit-ledger.service.ts`
- `entitlement.service.ts`
- DTOs and types for billing state

Recommended schema rules:

- immutable ledger table
- unique constraints for Stripe IDs
- unique constraint for processed webhook event IDs
- user-scoped read access under RLS where appropriate
- service-role/internal-only writes for webhook processing and settlement

Exit criteria:

- billing entities exist in the database and are queryable;
- the app can store billing state without yet using it to block runtime usage.

### Proposal 3: Credit Grants And Entitlement Reads

Suggested change name: `add-credit-grants-and-entitlements`

Status:

- archived on 2026-03-31

Goal:

- make Monti able to answer "what can this user do right now?" before wiring money collection.

Primary deliverables:

- free monthly grant logic;
- paid monthly grant logic shape, even if webhooks are not fully wired yet;
- balance computation and bucket ordering;
- API to fetch current billing state for the signed-in user;
- pricing rule resolution for `fast` and `quality`.

Recommended behavior:

- free users receive a monthly grant on a stable cycle anchor;
- monthly included credits do not roll over;
- top-up grants remain distinct from included grants;
- entitlement reads expose:
  - current plan
  - available included credits
  - available top-up credits
  - next refresh date or billing period end
  - per-tier credit costs

Recommended API:

- `GET /api/billing/me`

Exit criteria:

- the web app can display current plan and balance from real backend data;
- internal logic for grant math is test-covered.

### Proposal 4: Runtime Credit Enforcement And Settlement

Suggested change name: `enforce-credits-in-generation-runtime`

Status:

- archived on 2026-03-31

Goal:

- integrate monetization with the real generation path safely.

Primary deliverables:

- reserve credits at the `generate_experience` tool boundary;
- release reservations on failure, refusal, timeout, cancellation, or deduped replay;
- settle debits on successful persisted artifact outcomes only;
- expose billing-specific runtime errors when balance is insufficient.

Likely backend touchpoints:

- `backend/src/chat-runtime/tools/generate-experience-tool.service.ts`
- `backend/src/chat-runtime/services/conversation-loop.service.ts`
- `backend/src/chat-runtime/services/chat-runtime.service.ts`
- `backend/src/experience/services/experience-orchestrator.service.ts`
- billing services/repositories

Important design rule:

- enforce against actual selected tier, not just requested mode.
- In auto mode, charge based on the route actually chosen.

Important concurrency rule:

- if the same user triggers multiple generations concurrently, reservations must prevent overspend.

Frontend companion work in this proposal or the next:

- soft gating in `web/app/page.tsx`
- soft gating in `web/app/chat/[threadId]/page.tsx`
- low-balance messaging

Exit criteria:

- successful runs debit once;
- failed runs debit zero;
- concurrent in-flight runs cannot overspend credits;
- runtime integration has tests for duplicate settlement prevention.

### Proposal 5: Stripe Customer, Checkout, Webhooks, And Portal

Suggested change name: `integrate-stripe-billing`

Status:

- archived on 2026-04-01

Goal:

- connect Monti's internal billing model to Stripe's payment and subscription lifecycle.

Primary deliverables:

- Stripe customer creation and synchronization;
- subscription Checkout session creation;
- top-up Checkout session creation;
- Customer Portal session creation;
- verified webhook endpoint and event processing pipeline;
- internal subscription sync from Stripe events.

Recommended integration approach:

- Create Stripe customers lazily on the first billing action.
- Always pass the existing Stripe customer ID when creating Checkout sessions.
- Prevent duplicate subscriptions by using the known customer and Stripe's subscription-management patterns.
- Treat the webhook processor as idempotent and replay-safe.

Recommended backend routes:

- `POST /api/billing/checkout/subscription`
- `POST /api/billing/checkout/topup`
- `POST /api/billing/portal`
- `POST /api/billing/webhooks/stripe`

Recommended Stripe events to handle:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Recommended package/tooling additions:

- backend `stripe` SDK
- local Stripe CLI for webhook forwarding

Note:

- A simple launch can redirect the browser to Checkout using the session URL returned by the backend. This avoids needing a frontend Stripe SDK immediately.

Exit criteria:

- sandbox subscriptions and top-up purchases work end to end;
- webhooks update internal state and grants safely;
- customer portal opens from Monti and reflects the correct customer.

### Proposal 6: Public Pricing Surface And Funnel

Suggested change name: `build-public-pricing-funnel`

Status:

- archived on 2026-04-01

Goal:

- give non-authenticated users a clear pricing story and a usable path into paid conversion.

Primary deliverables:

- pricing section on the landing page in `web/app/page.tsx`;
- dedicated `/pricing` page for shareability and SEO;
- clear explanation of:
  - free allowance
  - paid allowance
  - `fast` and `quality`
  - top-ups
  - what counts as billable
  - what does not count as billable
- auth-aware CTA behavior.

Recommended CTA rules:

- signed out:
  - "Get started free"
  - "Choose paid plan"
  - plan selection persists through sign-up/sign-in
- signed in free:
  - "Upgrade now"
- signed in paid:
  - "Manage plan" and "Buy top-up"

Recommended implementation detail:

- reuse the existing "handoff" pattern from `web/lib/chat/prompt-handoff.ts` and create a pricing intent handoff so plan choice survives auth.

Recommended route additions:

- `web/app/pricing/page.tsx`
- `web/app/checkout/success/page.tsx`
- `web/app/checkout/cancel/page.tsx`

Exit criteria:

- public users can understand and begin the monetization funnel without entering the workspace first;
- authenticated plan purchase starts cleanly from public pricing surfaces.

### Proposal 7: Authenticated Billing Workspace

Suggested change name: `build-billing-workspace`

Status:

- archived on 2026-04-01

Goal:

- make billing visible and manageable inside the authenticated product.

Primary deliverables:

- a billing/settings page such as `/billing` or `/settings/billing`;
- current plan card;
- remaining credits display;
- ledger/history view;
- invoices and billing-management link;
- top-up CTA;
- low-credit states and paywall components;
- billing entrypoint from profile controls.

Likely frontend touchpoints:

- `web/app/components/floating-profile-controls.tsx`
- `web/app/page.tsx`
- `web/app/chat/[threadId]/page.tsx`
- new billing routes/components

Recommended runtime UX:

- show available credits on home/workspace pages;
- show per-tier credit cost near `GenerationModeDropdown`;
- show "insufficient credits" state with upgrade/top-up CTA;
- show renewal or next-cycle info on the billing page.

Exit criteria:

- a signed-in user can understand, manage, and act on billing state without leaving Monti except when redirected to Stripe-hosted surfaces.

### Proposal 8: Billing Ops, Reconciliation, And Support Tooling

Suggested change name: `add-billing-ops-and-reconciliation`

Goal:

- make the monetization system operable in production.

Primary deliverables:

- billing runbook
- webhook replay/reprocessing capability
- manual credit adjustment flow
- manual subscription support notes
- reconciliation queries/jobs
- alerts and dashboards

Recommended observability:

- structured logs for:
  - checkout session created
  - portal session created
  - webhook received
  - webhook processed
  - webhook failed
  - reservation created/released
  - debit settled
  - balance insufficient
  - manual credit adjustment
- dashboards for:
  - free-to-paid conversion
  - active subscriptions
  - top-up purchase rate
  - credit burn by tier
  - failed payments
  - webhook lag/failure
  - realized model cost vs credit revenue

Support capabilities needed:

- credit goodwill grants
- credit reversal for billing mistakes
- cash refund procedure
- subscription troubleshooting playbook

Exit criteria:

- production issues can be diagnosed and corrected without ad hoc SQL and guesswork.

### Proposal 9: Launch Hardening And Rollout

Suggested change name: `launch-monetization`

Goal:

- ship monetization safely in production.

Primary deliverables:

- staging billing environment with sandbox Stripe and staging Supabase
- test matrix for subscription lifecycle, failures, and top-ups
- Stripe test-clock scenarios
- migration/backfill for existing users
- rollout flags and phased enablement
- launch checklist and post-launch monitoring plan

Important rollout tasks:

- seed existing users into the free billing model
- do not backbill historical runs
- verify subscription renewals using test clocks
- verify payment failure handling
- verify cancellation and portal flows
- verify top-up grants
- enable public pricing independently from credit enforcement if needed

Recommended rollout flags:

- `PUBLIC_PRICING_ENABLED`
- `BILLING_ENABLED`
- `STRIPE_WEBHOOKS_ENABLED`
- `BILLING_PORTAL_ENABLED`
- `TOPUPS_ENABLED`
- `CREDIT_ENFORCEMENT_ENABLED`

Exit criteria:

- sandbox tests pass
- staging end-to-end purchase and renewal scenarios pass
- production can be enabled gradually and rolled back safely

## Cross-Cutting Concerns That Every Proposal Must Respect

### Idempotency

- webhook processing must dedupe on Stripe event ID
- top-up grants must not double-apply
- successful generation debits must not double-settle
- checkout retries must be traceable

### Security

- verify Stripe webhook signatures
- never trust client-submitted price IDs or credit amounts
- resolve internal plan keys server-side
- keep Stripe secret material server-only

### RLS and internal writes

- user-facing billing reads should remain user-scoped
- service-role/internal writes should handle webhook processing and settlement
- admin-only operations should not be exposed through normal user auth paths

### Anti-abuse

Free credits create an abuse surface.

Launch should consider:

- requiring verified email before full free-credit use in production
- rate limiting signup and generation attempts
- eventual anti-abuse controls for repeated free-account creation

### Cost analytics

Every monetization phase should preserve the ability to answer:

- what did we charge?
- what did it cost us internally?
- which model/tier/provider mix drove that cost?

## What Should Not Be In Launch Scope

To keep launch tractable, the following should stay out unless explicitly promoted later:

- team billing
- school/institution invoicing
- annual plans
- coupons and promotional campaigns
- usage-based Stripe billing or token-based customer pricing
- anonymous checkout-before-auth
- multi-seat entitlements
- tax-exempt organization flows
- deep custom subscription-management UI replacing the Stripe portal

## Definition Of Production-Ready Monetization For Monti

Monti should only consider monetization production-ready when all of the following are true:

- public pricing is live and understandable
- the user can subscribe and buy top-ups
- the user can manage plan/payment details through the portal
- successful generation/refinement outcomes debit exactly once
- failed outcomes debit zero
- free monthly grants and paid monthly grants work on the intended cycle anchors
- balances are visible in-product
- webhook failures are observable and replayable
- support can issue manual credit adjustments
- internal cost telemetry is persisted for generation and at least partially normalized for conversation/router overhead
- dormant provider configs remain out of launch pricing assumptions until routing changes
- staging has validated renewals, cancellations, and payment failures
