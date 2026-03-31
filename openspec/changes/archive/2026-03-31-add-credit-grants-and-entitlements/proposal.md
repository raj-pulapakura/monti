## Why

Billing persistence and configuration exist, but Monti cannot create recurring free grants, compute spendable balances with correct bucket ordering, or expose entitlement state to clients. Without that, the product cannot show truthful credits, prepare for runtime enforcement, or stay aligned with the monetization contract. This change implements **grants + entitlement reads + a billing API** before Stripe checkout and before hard generation gates.

## What Changes

- Implement **free monthly credit grants** with a defined cycle anchor and idempotency (one logical grant per user per cycle).
- Implement **entitlement computation**: eligible buckets, deterministic consumption order (recurring by earliest `cycle_end`, then top-ups by oldest grant), and **freeze top-up spend** when the user lacks an active paid entitlement per existing contract rules.
- Define **paid plan detection** from the existing `billing_subscriptions` mirror (empty until Stripe integration; behavior must be correct when rows appear).
- Add **`GET /api/billing/me`** (or equivalent under `api/billing`) returning plan context, pricing-rule version, per-tier costs, balances, bucket breakdown, and next refresh boundary where computable.
- Extend **`EntitlementService`** (and related repository methods) to load grants, apply rules, and optionally **ensure** the current-cycle free grant exists on read (lazy creation) or via explicit service method called from the controller.
- Add **unit/integration tests** for grant math, ordering, freeze rules, and API mapping.
- Update the **authenticated home workspace** to **fetch and display** a minimal billing summary (plan label + remaining credits + fast/quality costs) so the roadmap exit criterion is met without full chat soft-gating (deferred to runtime enforcement change).

## Capabilities

### New Capabilities

- _(none — behavior extends existing billing entitlement and workspace specs.)_

### Modified Capabilities

- `billing-credit-entitlements`: Add normative requirements for free-cycle grant creation rules, primary balance read model, and the authenticated billing summary HTTP contract.
- `home-screen-workspace`: Require a minimal authenticated-home billing summary sourced from the billing API.

## Impact

- **Backend**: `BillingModule` (controller, expanded `EntitlementService`, `BillingRepository`, possible small DTO module), `AppModule` or routing if a new controller is registered at root.
- **Web**: `web/app/page.tsx` (and possibly a small client helper for calling the backend with the session token — follow existing patterns used for chat API calls).
- **Database**: Prefer **no** new tables if existing `credit_grants`, `credit_ledger_entries`, `pricing_rule_snapshots`, and `billing_subscriptions` suffice; optional migration only if a discovered invariant requires it (document in design).
- **Dependencies**: No Stripe SDK; no new third-party billing libraries required for this change.
