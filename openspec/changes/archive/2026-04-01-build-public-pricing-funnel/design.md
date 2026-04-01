## Context

Proposals 1–5 are archived. The backend exposes `POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`, `POST /api/billing/portal`, and `GET /api/billing/me`. No frontend pricing or checkout surface exists yet.

Current relevant frontend state:
- `web/app/page.tsx` — `RootMode` pattern switches between `MarketingLanding` and `HomeWorkspace`; `HomeWorkspace` already fetches and renders the billing strip
- `web/app/auth/sign-in/page.tsx` — already reads `?next=` via `resolveSafeNextPath` and honors it after both email and OAuth auth
- `web/app/auth/sign-up/page.tsx` — hardcodes `nextPath: '/'` for OAuth and `router.replace('/')` after email auth; needs updating
- `web/app/components/floating-profile-controls.tsx` — only has sign-out; no billing nav

## Goals / Non-Goals

**Goals:**
- Give unauthenticated visitors a clear, honest pricing story with real numbers
- Make the path from "I want to pay" to Stripe checkout frictionless for both new and existing users
- Preserve billing intent through the sign-up flow using the existing `?next=` mechanism
- Confirm subscription activation after Stripe checkout without trusting the return URL for grants

**Non-Goals:**
- Top-up purchase flow (requires authenticated billing workspace — Proposal 7)
- Customer portal access (Proposal 7)
- Any backend changes — all required endpoints are live
- Stripe frontend SDK — not needed; backend returns the checkout URL directly
- New design tokens or CSS primitives — reuse existing `landing-*`, `auth-*`, and billing strip patterns

## Decisions

### 1. Use `?next=` for billing intent — no sessionStorage

**Decision:** Route unauthenticated "paid plan" CTAs to `/auth/sign-up?next=/checkout/start`. Update sign-up to read and honor `?next=` identically to sign-in. No new sessionStorage key.

**Why:** Sign-in already implements this pattern with `resolveSafeNextPath`. Reusing it makes intent survive OAuth redirects naturally (the callback URL carries `next` through the full OAuth round-trip). sessionStorage would require a write before redirect and a read after — more surface area, and it doesn't survive OAuth tab replacements in all browsers.

**Alternative considered:** `monti_pricing_intent_v1` sessionStorage key (similar to `prompt-handoff`). Rejected because `?next=` already solves the problem and is proven in the sign-in path.

### 2. `/checkout/start` as auto-redirect — no confirmation step

**Decision:** `/checkout/start` shows a brief spinner, immediately POSTs to create a subscription checkout session on mount, and does `window.location.href = data.checkoutUrl`. No "you are about to subscribe" confirmation page.

**Why:** The user committed on the pricing page. Adding a second confirmation step is friction with no UX benefit — Stripe's own hosted checkout page serves as the final confirmation (it shows the plan, price, and payment form before charging). An extra Monti-side confirmation page would be an inferior copy of that.

**Unauthenticated access:** `/checkout/start` checks auth on mount. If no session, redirects to `/auth/sign-in?next=/checkout/start`. (This is a fallback; the normal path routes through `/auth/sign-up?next=/checkout/start` from the pricing CTA.)

### 3. `/checkout/success` polls `GET /api/billing/me` — does not trust `session_id`

**Decision:** Poll `GET /api/billing/me` at 1.5s intervals, stop when `plan === 'paid'`, cap at ~10s. Use the `session_id` query param only for display context (if useful), never to grant credits or confirm payment.

**Why:** The roadmap's foundational decision is "never use redirect return pages as the authority for access or grants." Webhooks are the authority. Polling the backend is the correct pattern — it confirms that the webhook fired and state propagated, giving users honest real-time confirmation. In practice, webhooks typically fire within 2–3 seconds of checkout completion.

**Timeout fallback:** After ~10s of polling without detecting `plan === 'paid'`, show: "Your subscription is activating — credits will be available shortly." This handles slow webhook delivery gracefully without leaving users confused.

### 4. Landing page pricing section — inline, not a teaser link

**Decision:** Add a full two-column Free/Paid pricing section directly in `MarketingLanding` below the existing feature cards, with real numbers and CTAs. Link to `/pricing` for the full detail view.

**Why:** Teachers (Monti's audience) are budget-conscious institutional buyers. Transparency builds trust — hiding pricing behind a click introduces unnecessary doubt. The landing page already converts visitors; pricing visible on the first scroll improves conversion and reduces support questions.

**Pricing numbers** sourced from `LAUNCH_PRICING_VERSION_KEY = 'launch-v1'` contract:
- Free: 15 credits/month, no cost
- Paid: 150 credits/month, $10/month
- Fast generation: 1 credit
- Quality generation: 5 credits
- Top-up (paid users only): 50 credits for $4

### 5. Auth-aware CTA state machine on `/pricing`

`/pricing` is a client component that checks Supabase session on mount (same pattern as `page.tsx`). Four render states:

```
loading-auth     → skeleton CTAs (prevent flash of wrong state)
not-authenticated → "Get started free" → /auth/sign-up
                    "Choose paid plan" → /auth/sign-up?next=/checkout/start
free-plan         → "Upgrade to paid plan" → POST /api/billing/checkout/subscription → window.location
paid-plan         → "Manage subscription" → POST /api/billing/portal → window.location
                    "Buy credits" → POST /api/billing/checkout/topup → window.location (if TOPUPS_ENABLED)
```

For authenticated users, the POST → redirect is inline (no intermediate route needed) since the user is already authed.

### 6. Sign-up `?next=` — minimal surgical change

**Decision:** In `sign-up/page.tsx`:
1. Wrap in `<Suspense>` (needed for `useSearchParams`, matching sign-in's pattern)
2. Read `resolveSafeNextPath(searchParams.get('next'))` into `nextPath`
3. Pass `nextPath` to `signInWithOAuthProvider` instead of hardcoded `'/'`
4. Use `router.replace(nextPath)` after successful email sign-up session
5. Update `buildSignUpEmailRedirectUrl` to thread `nextPath` through the callback URL for email-confirmation flows

This is a direct parallel to the existing sign-in implementation.

## Risks / Trade-offs

- **Webhook delay on success page** → Mitigated by polling with a 10s cap and a graceful fallback message. Users who see the fallback are not broken — they just have to wait a moment for credits to appear.

- **`/checkout/start` double-POST on mount re-render** → Mitigated by using a `useRef` flag or `useEffect` with empty deps to ensure the POST fires exactly once per mount. React StrictMode double-invocation in dev is acceptable since sandbox Stripe sessions are free.

- **Sign-up email confirmation + `?next=`** → Email confirmation flows go through `auth/callback?next=X`. The `buildSignUpEmailRedirectUrl` must include `next` in the callback URL for this to work end-to-end. This is included in the sign-up change scope.

- **Paid user hitting `/checkout/start`** → The backend will likely return an error or no-op for already-subscribed users. `/checkout/start` should handle API errors gracefully and link back to `/pricing` (which will show the correct "Manage subscription" CTA for paid users).

## Migration Plan

No schema changes, no backend changes, no migrations. All changes are frontend-only. Deployment is a standard Next.js build.

New routes are additive — existing routes and behavior are unchanged except:
- `sign-up/page.tsx`: behavioral change is backward-compatible (missing `?next=` falls back to `/`)
- `floating-profile-controls.tsx`: additive menu item, no existing item removed

## Open Questions

_(none — all decisions resolved during exploration)_
