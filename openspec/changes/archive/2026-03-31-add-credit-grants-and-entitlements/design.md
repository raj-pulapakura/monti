## Context

Monti has `BillingModule` scaffolding, `pricing_rule_snapshots` seeded with `launch-v1`, `credit_grants` / `credit_reservations` / `credit_ledger_entries`, and `billing_subscriptions` for a future Stripe mirror. Published specs already define bucket ordering, top-up freeze rules, reservation/settlement (later), and entitlement exposure. Chat APIs use `AuthGuard` and bearer JWTs; the web app calls the backend with user tokens.

## Goals / Non-Goals

**Goals:**

- Make **free users** receive a **monthly included grant** on a deterministic cycle with **idempotent** creation (no duplicate grants for the same user and cycle).
- Compute **spendable** and **display** balances using **eligible** `credit_grants` rows, honoring **recurring vs top-up** ordering rules and **freezing top-ups** when paid entitlement is inactive.
- Expose **`GET /api/billing/me`** (authenticated) returning plan context, active pricing-rule identity, fast/quality costs, aggregates, bucket summary, and **next free-cycle boundary** (and subscription period end when mirror data exists).
- Append matching **`credit_ledger_entries`** when issuing free monthly grants so support can trace grants without relying only on `credit_grants`.
- Show a **minimal billing summary** on the authenticated home workspace backed by the new API.

**Non-Goals:**

- Stripe Checkout, webhooks, portal, or customer creation.
- Runtime **reservation** creation, **debit settlement**, or hard/soft blocking in `generate_experience` (Proposal 4).
- Chat thread UI credit display and paywall UX (may remain for a later change).
- Admin/support tools, materialized balance tables, or reconciliation jobs.
- Changing launch numeric catalog values (still sourced from `launch-v1` / config).

## Decisions

### 1. Free-plan cycle anchor

**Choice:** **UTC calendar month** boundaries for the free recurring grant.

- `cycle_start` = `date_trunc('month', now() at time zone 'UTC')` in UTC.
- `cycle_end` = first instant of the **next** UTC month (exclusive end semantics in API: “refresh at” = `cycle_end`).

**Alternatives:** Signup anniversary (fairer per user, harder to index and explain). Deferred unless product resets the contract.

### 2. Idempotent free grant creation

**Choice:** Before computing entitlements for a free-tier user, **ensure** a `credit_grants` row exists for `(user_id, bucket_kind = recurring_free, cycle_start)` matching the current UTC month, using a **single transactional upsert or insert-if-not-exists** pattern that cannot create duplicates under concurrency (database unique constraint preferred).

**Alternatives:** Nightly job only — rejected; reads would show stale zero until job runs.

### 3. Paid entitlement signal (pre-Stripe and post-Stripe)

**Choice:** Treat **paid entitlement as active** when there exists a `billing_subscriptions` row for the user with `current_period_end` **strictly after** `now()` (UTC). Ignore mirror `status` strings in v1 logic until Stripe sync populates reliable enums; refine status filtering when webhook integration lands.

**Alternatives:** Status substring matching now — brittle without enforced enum.

### 4. Primary read model for `/me` balances

**Choice:** **Authoritative for display and pre-enforcement**: aggregate **eligible** `credit_grants` (by `cycle_end`, `created_at`, `bucket_kind`, paid flag) plus **`reserved_credits`** on those rows. **Ledger** is written when grants are created/adjusted for audit; full ledger replay for balance is **not** required in this change.

**Invariant (this change):** Maintain `credit_grants` so **`remaining_credits`** is the **spendable pool** on that bucket and **`reserved_credits`** is the portion currently held for in-flight work. Therefore **available on bucket** = `remaining_credits - reserved_credits` (clamp at zero). When no runtime reservations exist yet, `reserved_credits` stays `0`.

**Note:** Proposal 4 must update `remaining_credits` / `reserved_credits` consistently when reservations settle; this design locks the read formula now.

### 5. Bucket eligibility and ordering (implementation recipe)

- **Recurring free:** `bucket_kind = recurring_free`, `cycle_end > now()`, `remaining_credits - reserved_credits > 0`.
- **Recurring paid:** `bucket_kind = recurring_paid`, same time and balance rules, only if paid entitlement active.
- **Top-up:** `bucket_kind = topup`, balance positive, **only if** paid entitlement active (else excluded entirely from spendable totals).
- **Manual/promo:** `bucket_kind = manual` (and `promo` source if used), included after recurring and top-up per contract: recurring ordered by **earliest `cycle_end`**, top-ups by **oldest `created_at`**.

### 6. HTTP surface

**Choice:** `GET /api/billing/me` on a dedicated `BillingController` with `AuthGuard`, same JWT pattern as chat. Response includes at least: `billingEnabled`, `freeCreditGrantsEnabled`, `plan` (`free` | `paid`), `pricingRuleVersionKey`, `costs: { fastCredits, qualityCredits }`, `includedCreditsAvailable`, `topupCreditsAvailable`, `reservedCreditsTotal`, `buckets: [...]`, `nextIncludedRefreshAt` (UTC ISO), `paidPeriodEndsAt` (nullable).

When **`BILLING_ENABLED`** is false, return **200** with `billingEnabled: false` and null or zero numeric fields so the UI can hide the strip without error spam.

### 7. Home workspace UI

**Choice:** Small, non-blocking summary (text or compact chip) above or beside the create flow; **no** blocking modal. Errors: show nothing or a subtle “Billing unavailable” per existing design language.

## Risks / Trade-offs

- **[Risk] UTC calendar month feels unfair vs local timezone** → Mitigation: document in product copy later; v1 optimizes implementability.
- **[Risk] `billing_subscriptions` empty** → Mitigation: all users appear **free** until Stripe; paid grants remain future-only.
- **[Risk] Concurrent first grant** → Mitigation: unique partial index or upsert on `(user_id, bucket_kind, cycle_start)` if added in migration; otherwise serializable transaction — **design prefers a DB uniqueness constraint** if the schema does not already guarantee one (add migration in this change if needed).
- **[Risk] Grant/ledger drift** → Mitigation: write ledger row in same transaction as grant insert; tests assert pairing.

## Migration Plan

1. Land backend + web changes behind existing env flags.
2. Apply optional migration if a uniqueness constraint for free monthly grants is required.
3. Enable `BILLING_ENABLED` / `FREE_CREDIT_GRANTS_ENABLED` in staging; verify `/me` and home UI.
4. Rollback: disable flags; prior behavior is “billing off”.

## Open Questions

- Whether to show **billing summary on chat** in the same change if home alone satisfies exit criteria (default: **home only**).
- Exact **Stripe status** filtering once webhook sync exists (revisit when integrating Stripe).
