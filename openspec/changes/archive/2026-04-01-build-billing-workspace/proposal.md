## Why

Signed-in users have no dedicated place to understand or act on their billing state — the current `/pricing` page doubles as a marketing surface and a management UI, and the chat workspace gives users no signal about credit costs or balance until they hit a backend error. Proposal 7 closes this gap by adding a real billing workspace and surfacing credit awareness inside the product.

## What Changes

- New `/billing` route: an auth-required page showing plan status, included and top-up credit balances, upgrade/manage/top-up CTAs, and a link to Stripe invoice history via the portal.
- Profile menu "Billing & plan" link updated from `/pricing` → `/billing`.
- Chat thread page gains a parallel billing fetch, a per-mode credit cost indicator near the `GenerationModeDropdown`, and a soft-gate warning + disabled submit when balance is insufficient for the selected mode.
- Home workspace billing strip gains top-up credits display (the field already exists in `BillingMeData` but is not currently rendered).
- No new backend endpoints required — all surfaces consume the existing `GET /api/billing/me`, `POST /api/billing/checkout/topup`, and `POST /api/billing/portal`.

## Capabilities

### New Capabilities

- `authenticated-billing-workspace`: Authenticated `/billing` page with plan card, credit balance card (included + top-up), upgrade/manage/top-up CTAs, Stripe portal invoice link, and updated profile menu entry point.
- `chat-credit-awareness`: Billing state fetch in the chat thread page, per-mode credit cost label near the mode selector, and soft-gate state (disabled submit + inline warning) when balance is insufficient.

### Modified Capabilities

- `home-screen-workspace`: Billing strip extended to display top-up credits available alongside included credits.

## Impact

- **New route**: `web/app/billing/page.tsx`
- **Modified**: `web/app/components/floating-profile-controls.tsx` (menu link target)
- **Modified**: `web/app/chat/[threadId]/page.tsx` (billing fetch + credit indicator + soft gate)
- **Modified**: `web/app/page.tsx` (top-up credits in billing strip)
- **No backend changes** — all new surfaces use existing endpoints
- **Dependencies**: `@/lib/api/billing-me` types already cover all required fields
