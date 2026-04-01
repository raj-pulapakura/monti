## 1. Profile Menu Entry Point

- [x] 1.1 Update `floating-profile-controls.tsx`: change "Billing & plan" `href` from `/pricing` to `/billing`

## 2. Home Workspace Billing Strip

- [x] 2.1 Update `HomeWorkspace` in `web/app/page.tsx`: render top-up credits in the billing strip when `topupCreditsAvailable > 0`

## 3. /billing Page

- [x] 3.1 Create `web/app/billing/page.tsx` with auth session check; redirect unauthenticated visitors to `/auth/sign-in?next=/billing`
- [x] 3.2 Add billing state fetch from `GET /api/billing/me` on mount
- [x] 3.3 Implement plan card: plan label, refresh/period-end date, upgrade button (free) or manage subscription button (paid)
- [x] 3.4 Wire upgrade button to `POST /api/billing/checkout/subscription` and redirect to returned URL
- [x] 3.5 Wire manage subscription button to `POST /api/billing/portal` with `returnUrl: /billing` and redirect to returned URL
- [x] 3.6 Implement credits card: included credits, top-up credits, fast/quality costs, buy top-up button (paid users only)
- [x] 3.7 Wire buy top-up button to `POST /api/billing/checkout/topup` and redirect to returned URL
- [x] 3.8 Add invoice history link/button that calls `POST /api/billing/portal` with `returnUrl: /billing`
- [x] 3.9 Add loading skeleton state while billing fetch is in flight
- [x] 3.10 Add recoverable error state when billing fetch fails

## 4. Chat Page Credit Awareness

- [x] 4.1 Add `billingData` state and parallel billing fetch in `web/app/chat/[threadId]/page.tsx` (alongside thread hydration)
- [x] 4.2 Compute `totalAvailableCredits` (included + top-up) and `costForMode` from billing data and selected generation mode
- [x] 4.3 Add credit cost label adjacent to `GenerationModeDropdown` in the composer area (render only when billing enabled and costs available)
- [x] 4.4 Implement soft-gate: disable submit button when billing data is loaded and `totalAvailableCredits < costForMode`
- [x] 4.5 Render inline warning message when soft-gate is active: free users get an upgrade link to `/billing`; paid users get a buy top-up action calling `POST /api/billing/checkout/topup`
- [x] 4.6 Ensure soft-gate is not applied while billing fetch is still in flight (no gate until data resolves)
