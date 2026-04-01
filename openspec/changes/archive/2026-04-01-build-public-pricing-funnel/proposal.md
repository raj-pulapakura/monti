## Why

The billing backend is fully implemented (proposals 1–5 archived), but the product has no public pricing surface — visitors cannot discover what Monti costs, and there is no path from a marketing visit to a paid subscription. This change builds the frontend funnel that connects the public landing experience to Stripe checkout.

## What Changes

- **Landing page pricing section** — real numbers (15 free / 150 paid / fast=1 credit / quality=5 credits / $10/month / 50 credits for $4) added as an inline section on the existing `MarketingLanding` component in `web/app/page.tsx`
- **`/pricing` route** — standalone, always-accessible pricing page with auth-aware CTAs; the canonical shareable URL for pricing
- **`/checkout/start` route** — thin authenticated intermediary that auto-POSTs to `POST /api/billing/checkout/subscription` and redirects the browser to the Stripe-hosted checkout URL (no secondary confirmation step)
- **`/checkout/success` route** — post-Stripe return page that polls `GET /api/billing/me` until `plan === 'paid'` is detected (cap ~10s), then confirms activation; falls back to a static activation-pending message on timeout
- **`/checkout/cancel` route** — abandoned-checkout recovery page linking back to `/pricing`
- **Sign-up `?next=` support** — `web/app/auth/sign-up/page.tsx` updated to read and honor the `?next=` query param the same way sign-in already does, enabling the unauthenticated-to-checkout funnel
- **Profile menu billing entry point** — "Billing & plan" item added to `FloatingProfileControls` linking to `/pricing`

## Capabilities

### New Capabilities

_(none — all capability areas already exist in `openspec/specs/`)_

### Modified Capabilities

- `public-pricing-funnel`: add requirements for `/checkout/start` auto-redirect behavior, `/checkout/success` polling behavior, `/checkout/cancel` recovery behavior, and landing page inline pricing section with real plan numbers
- `user-authentication`: add requirement — sign-up flow MUST honor the `?next=` query param and route there after successful authentication, consistent with existing sign-in behavior
- `home-screen-workspace`: add requirement — `FloatingProfileControls` MUST include a "Billing & plan" navigation entry point linking authenticated users to the pricing/billing surface

## Impact

**Frontend — new routes:**
- `web/app/pricing/page.tsx`
- `web/app/checkout/start/page.tsx`
- `web/app/checkout/success/page.tsx`
- `web/app/checkout/cancel/page.tsx`

**Frontend — modified files:**
- `web/app/page.tsx` — adds pricing section to `MarketingLanding`
- `web/app/auth/sign-up/page.tsx` — adds `?next=` param support
- `web/app/components/floating-profile-controls.tsx` — adds billing nav item

**Backend — no changes** (all required endpoints are already live)

**No new dependencies** — Stripe redirect uses the checkout URL returned by the backend; no frontend Stripe SDK needed
