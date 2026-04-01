## Context

Proposals 2–6 shipped the billing backend (tables, ledger, entitlements, Stripe checkout/webhooks) and the public pricing funnel. The authenticated product has minimal billing visibility: the home workspace shows a read-only billing strip, the profile menu links to `/pricing`, and the chat page has no billing awareness at all.

`GET /api/billing/me` already returns everything needed: `plan`, `includedCreditsAvailable`, `topupCreditsAvailable`, `costs.fastCredits`, `costs.qualityCredits`, `nextIncludedRefreshAt`, `paidPeriodEndsAt`, `billingEnabled`. The checkout and portal endpoints are live. No backend work is required.

## Goals / Non-Goals

**Goals:**
- Authenticated users have a dedicated `/billing` page to understand and act on their billing state
- The chat page gives users passive credit cost visibility and a proactive soft-gate before a backend rejection
- The home billing strip reflects full credit state (included + top-up)
- The profile menu entry point routes to `/billing` instead of `/pricing`

**Non-Goals:**
- Credit ledger / transaction history (deferred — Stripe portal covers invoice history for paid users)
- New backend endpoints (all surfaces use existing APIs)
- Any changes to the public `/pricing` page
- Billing state persistence across pages via React context or shared store (not needed at this scale)

## Decisions

### 1. `/billing` is auth-required at the page level, not middleware-guarded

The page component checks the session on mount and redirects to `/auth/sign-in?next=/billing` if unauthenticated. This matches the pattern already used in `/pricing` and the chat page — no Next.js middleware change needed.

_Alternative considered_: Next.js middleware route guard. Rejected because the existing pattern is client-side session resolution, and adding middleware for one new route introduces inconsistency without meaningful benefit at this scale.

### 2. Billing fetch in chat page is local state, not a shared context/provider

Each page that needs billing state (home, chat, billing) fetches `GET /api/billing/me` independently on mount. No React context or global store.

_Alternative considered_: App-level billing context provider. Rejected because it adds architectural complexity for a request that is cheap, infrequently changes, and is already being made redundantly across pages. A context would be appropriate if billing state needed to update in real-time (e.g., after a successful generation). It doesn't — the debit happens server-side and the user would reload anyway.

### 3. Soft-gate is purely client-side and non-blocking

The composer submit button is disabled when `billingData` is loaded AND `totalAvailable < costOfSelectedMode`. If billing data has not yet loaded, no gate is applied — the user can submit and the backend will reject if needed. The backend remains authoritative.

_Why_: Avoids a jarring experience where the composer appears locked while billing loads in parallel with thread hydration.

### 4. Top-up CTA in chat is only shown for paid users with insufficient balance

Free users with zero credits see an upgrade CTA (link to `/billing`). Paid users with insufficient credits see a top-up action (calls `POST /api/billing/checkout/topup`). The distinction maps to the actual recovery path: free users need to subscribe first before buying top-ups.

### 5. Portal `returnUrl` for all `/billing` page calls is `/billing`

Both the manage-subscription and invoice-history portal sessions on the billing page use `returnUrl: window.location.origin + '/billing'`. The `/pricing` page already uses `/pricing` as its own return URL and that stays unchanged.

## Risks / Trade-offs

- **Stale billing state in chat**: The billing fetch happens once on mount. If a user generates several times in one session, their displayed balance may lag. → Acceptable at launch; the backend hard-gate prevents overspend. A future improvement could refresh billing state after a successful `run_completed` event.

- **Billing strip in home showing zero top-up credits**: When `topupCreditsAvailable` is 0, showing "0 top-up credits" is noise. → Render top-up credits only when `> 0`, as specified.

- **Checkout and portal redirect failures**: If `POST /api/billing/checkout/topup` or `POST /api/billing/portal` fail, the user is stranded. → Show inline error message and restore button to interactive state (same pattern as `/pricing` today).

## Migration Plan

No database migrations or backend deployments required. All changes are frontend-only.

Deployment order:
1. Deploy frontend with `/billing` page and updated profile menu link.
2. The old `/pricing` link in the profile menu stops working for direct billing management — but `/pricing` still exists and functions as a public page, so no hard breakage for anyone who bookmarked it.
3. No rollback complexity — feature flags are not required since billing is already enabled.

## Open Questions

- None blocking implementation.
