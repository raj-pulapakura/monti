## 1. Sign-up `?next=` support

- [x] 1.1 Wrap `sign-up/page.tsx` default export in `<Suspense>` with a fallback, extract inner form into a `SignUpForm` component (matching sign-in's pattern)
- [x] 1.2 Read `resolveSafeNextPath(searchParams.get('next'))` into `nextPath` inside `SignUpForm` using `useSearchParams`
- [x] 1.3 Pass `nextPath` to `signInWithOAuthProvider` instead of the hardcoded `'/'`
- [x] 1.4 Replace `router.replace('/')` with `router.replace(nextPath)` after successful email sign-up session
- [x] 1.5 Update `buildSignUpEmailRedirectUrl` in `web/lib/auth/auth-flow.ts` to accept and embed `nextPath` in the callback URL so email-confirmation flows also honor `?next=`
- [x] 1.6 Update `signUpWithEmailPassword` call in sign-up page to pass `nextPath` through to the redirect URL

## 2. Profile controls billing entry point

- [x] 2.1 Add a "Billing & plan" menu item to `FloatingProfileControls` in `web/app/components/floating-profile-controls.tsx` that links to `/pricing`, placed above the sign-out item

## 3. `/pricing` page

- [x] 3.1 Create `web/app/pricing/page.tsx` as a `'use client'` component with Supabase session check on mount (loading / not-authenticated / free-plan / paid-plan states)
- [x] 3.2 Render skeleton CTAs while auth state is loading to prevent flash of wrong state
- [x] 3.3 Render the unauthenticated state: free plan column with "Get started free" → `/auth/sign-up` CTA, paid plan column with "Choose paid plan" → `/auth/sign-up?next=/checkout/start` CTA
- [x] 3.4 Render the free-plan state: "Upgrade to paid plan" button that POSTs to `POST /api/billing/checkout/subscription`, receives `checkoutUrl`, and sets `window.location.href`
- [x] 3.5 Render the paid-plan state: "Manage subscription" button that POSTs to `POST /api/billing/portal`, receives `portalUrl`, and sets `window.location.href`
- [x] 3.6 Show real plan numbers on both plan columns: free (15 credits/month, fast=1cr, quality=5cr), paid ($10/month, 150 credits/month, fast=1cr, quality=5cr, top-up 50cr for $4)
- [x] 3.7 Add "What counts as a credit?" explanation section covering: fast generation costs 1 credit, quality generation costs 5 credits, failed/cancelled runs cost nothing
- [x] 3.8 Add a "Full pricing details" link on the landing page pricing section pointing to `/pricing`

## 4. Landing page pricing section

- [x] 4.1 Add a pricing section to `MarketingLanding` in `web/app/page.tsx` below the existing `landing-grid` section
- [x] 4.2 Render a two-column plan comparison (Free / Paid) with real numbers matching the `/pricing` page values
- [x] 4.3 Add unauthenticated CTAs: "Get started free" → `/auth/sign-up` and "Choose paid plan" → `/auth/sign-up?next=/checkout/start`
- [x] 4.4 Add a "See full pricing →" link to `/pricing`

## 5. `/checkout/start` route

- [x] 5.1 Create `web/app/checkout/start/page.tsx` as a `'use client'` component
- [x] 5.2 On mount, check Supabase session; if unauthenticated redirect to `/auth/sign-in?next=/checkout/start`
- [x] 5.3 Use a `useRef` flag to ensure the POST to `POST /api/billing/checkout/subscription` fires exactly once per mount
- [x] 5.4 On success, set `window.location.href = data.checkoutUrl` to redirect to Stripe-hosted checkout
- [x] 5.5 On API error, show an error message and a link back to `/pricing`
- [x] 5.6 Show a loading/spinner state while the session is being created

## 6. `/checkout/success` route

- [x] 6.1 Create `web/app/checkout/success/page.tsx` as a `'use client'` component
- [x] 6.2 On mount, begin polling `GET /api/billing/me` at 1.5s intervals using the authenticated API client
- [x] 6.3 Stop polling and show success confirmation when `plan === 'paid'` is detected; display plan name and remaining credits
- [x] 6.4 Stop polling and show activation-pending fallback message after ~10s if `plan === 'paid'` is not yet detected
- [x] 6.5 Clean up polling interval on component unmount
- [x] 6.6 Show a visible link to the home workspace (`/`) in all states (polling, confirmed, pending fallback)

## 7. `/checkout/cancel` route

- [x] 7.1 Create `web/app/checkout/cancel/page.tsx` as a simple page with a calm no-pressure message and a prominent link back to `/pricing`

## 8. CSS

- [x] 8.1 Add CSS classes for the landing pricing section (`landing-pricing`, `landing-pricing-grid`, `landing-plan-card`, etc.) following the existing `landing-*` naming convention in `web/app/globals.css`
- [x] 8.2 Add CSS classes for the `/pricing` page (`pricing-shell`, `pricing-hero`, `pricing-grid`, `pricing-plan`, etc.)
- [x] 8.3 Add CSS classes for `/checkout/start`, `/checkout/success`, and `/checkout/cancel` pages (can reuse `auth-shell` / `auth-card` pattern for simplicity)
