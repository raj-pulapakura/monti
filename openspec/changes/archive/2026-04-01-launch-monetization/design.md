## Context

All billing infrastructure is shipped and behind feature flags. The flags exist in `BillingConfigService` and are off by default. The only remaining work before production launch is validating the full lifecycle in a staging environment and establishing the safe flag-enable sequence for production.

Staging environment: Railway + Supabase (same stack as production), with sandbox Stripe keys and Stripe CLI for local webhook forwarding during development. Stripe test clocks are used to simulate renewal, payment failure, and cancellation without waiting for real time to pass.

## Goals / Non-Goals

**Goals:**
- Define and document the staging test matrix so every launch scenario is validated before a production flag is touched.
- Define the production flag-enable sequence and the gate criteria between each step.
- Produce `docs/billing/launch-checklist.md` as the single artifact an operator consults during rollout.

**Non-Goals:**
- No code changes to billing modules, controllers, or schemas.
- No automated test infrastructure (scenarios are manual staging runs using Stripe CLI / test clocks).
- No changes to existing feature flag mechanics — flags already work.

## Decisions

### Decision: Deliver the launch checklist as a doc, not as code

The launch scenarios require a human to interact with Stripe Dashboard, test clocks, and the Stripe CLI. Automating them as CI tests would require a live Stripe sandbox, API keys in CI, and significant test harness work that isn't worth the investment at this stage. The checklist doc gives operators a clear, repeatable script.

Alternatives considered: Stripe test-clock automation via the Stripe Node SDK in an e2e test suite. Deferred — viable for a later hardening pass but out of scope for launch.

### Decision: Enable flags in order of blast radius, smallest first

Order: `BILLING_ENABLED` → `FREE_CREDIT_GRANTS_ENABLED` → `STRIPE_WEBHOOKS_ENABLED` → `BILLING_PORTAL_ENABLED` → `TOPUPS_ENABLED` → `CREDIT_ENFORCEMENT_ENABLED`

Rationale: `CREDIT_ENFORCEMENT_ENABLED` is the highest-blast-radius flag (it blocks generation for users without credits). It goes last, after all other surfaces are confirmed working, so a rollback only requires toggling one flag without disrupting already-working billing flows.

### Decision: Stripe test clocks for renewal and failure scenarios

Stripe test clocks let staging simulate a full 30-day billing cycle in seconds. Required scenarios: first invoice, renewal, `invoice.payment_failed`, subscription cancellation, and reactivation. These cannot be tested without test clocks in a reasonable timeframe.

## Risks / Trade-offs

- [Risk] Staging Stripe environment not fully configured (missing price IDs, portal settings) → Mitigation: checklist includes a pre-flight section verifying all env vars and Stripe Dashboard config before any test begins.
- [Risk] Webhook delivery timing in staging differs from production → Mitigation: use Stripe CLI `stripe listen --forward-to` for local development; use configured webhook endpoint for Railway staging.
- [Risk] Operator skips steps under launch pressure → Mitigation: checklist uses a checkbox format so each step is explicitly acknowledged.

## Migration Plan

No schema or code migrations. Rollout is flag-driven:

1. Enable flags one at a time in the specified sequence on staging, run the corresponding test matrix section.
2. Once all staging scenarios pass, repeat the same flag sequence on production.
3. Rollback: set any flag back to `false` / unset the env var and redeploy — no data mutations required.

## Open Questions

- Should `FREE_CREDIT_GRANTS_ENABLED` and `BILLING_ENABLED` be enabled simultaneously on first production deploy, or should `BILLING_ENABLED` go first with grants disabled briefly? Recommendation: enable both together — grants are inert without `BILLING_ENABLED` and there is no harm in enabling them at the same time.
- Stripe Tax: decision deferred from roadmap. Must be resolved before live launch; does not affect staging validation.
