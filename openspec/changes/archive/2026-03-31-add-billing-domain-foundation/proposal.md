## Why

Monti’s monetization contract and LLM usage telemetry are in place, but there is no durable billing domain in the codebase or database. Shipping Stripe, entitlements, or runtime credit enforcement without a first-class persistence layer and Nest boundary would scatter state, complicate idempotency, and make audits unsafe. This change adds the **foundation only**: schema, module wiring, configuration, and repositories—without turning on enforcement or money collection.

## What Changes

- Add Supabase migrations (and declarative schema alignment) for billing entities: customer mapping, subscription mirror, checkout session records, webhook event store, credit grants, reservations, immutable ledger entries, and pricing-rule snapshots (names and columns per design).
- Introduce a Nest `BillingModule` with configuration service for plan catalog, pricing-rule versioning, and feature flags (`BILLING_ENABLED`, etc.) read from environment.
- Add repository/service scaffolding for writes and reads needed by later proposals (no integration into `GenerateExperienceToolService` or Stripe yet).
- Regenerate or update `backend/src/supabase/supabase.types.ts` for new tables.
- No new public billing HTTP routes required for exit criteria of this change (optional health-only or internal-only wiring is acceptable if useful for tests).
- No Stripe SDK dependency or webhook endpoint in this change unless explicitly scoped as a no-op stub (prefer deferring Stripe to the dedicated integration change).

## Capabilities

### New Capabilities

- `billing-domain-persistence`: Durable storage, integrity constraints, and internal backend APIs for billing-related entities so later work (grants, entitlements, Stripe, runtime settlement) can attach to a single source of truth without re-litigating table shape.

### Modified Capabilities

- _(none — existing `billing-credit-entitlements` and `billing-payment-lifecycle` specs remain the behavioral contract; this change materializes persistence that satisfies them incrementally.)_

## Impact

- **Backend**: New `backend/src/billing/` module; `app.module.ts` imports `BillingModule`.
- **Database**: New Supabase migration(s); `supabase/schemas/` snapshot updates if the project uses declarative schema.
- **Types**: `supabase.types.ts` (or equivalent) updates.
- **Environment**: New documented env vars for billing flags and future Stripe price IDs (values may be empty in dev).
- **Dependencies**: No production Stripe dependency in this change if avoidable.
- **Runtime behavior**: User-visible behavior and generation paths unchanged unless guarded by flags and explicitly no-op.
