## Why

Authenticated users currently see the public marketing landing on the first paint of `/` because the root route is a client-only component that defaults to marketing until `getSession()` runs in `useEffect`. That undermines trust and contradicts the product’s session-aware root contract. Resolving session on the server aligns the first HTML response with reality.

## What Changes

- Add Next.js `middleware` for the web app that refreshes the Supabase cookie session (same `@supabase/ssr` pattern as the existing proxy helper) and continues to apply `resolveAuthRouteRedirect` for protected and auth-entry routes.
- Replace the all-client root `/` implementation with a thin **async Server Component** `page.tsx` that reads the session from cookies (via the existing server Supabase helper, adjusted if needed for RSC cookie-write constraints) and passes minimal initial auth props into the existing interactive UI.
- Refactor the current `app/page.tsx` client bundle into a dedicated client module that **initializes** marketing vs home from server props and still subscribes to `onAuthStateChange` for live updates (sign-in, sign-out, refresh).
- Consolidate or remove the standalone `web/proxy.ts` file so session refresh logic lives in one place (`middleware.ts` importing shared helpers), avoiding duplicate maintenance.

## Capabilities

### New Capabilities

_(none — behavior is a tightening of existing root-route requirements.)_

### Modified Capabilities

- `home-screen-workspace`: Require that the initial response for `/` does not show marketing to a user who already has a valid session (server-resolved branch before client auth init).
- `web-public-protected-routing`: Same first-paint requirement for `/` and explicit use of middleware (or equivalent edge) session refresh so server reads are consistent with protected routing.

## Impact

- **Code**: `web/app/page.tsx`, new `web/middleware.ts`, `web/lib/supabase/server.ts` (or shared helper), `web/lib/supabase/proxy.ts` (folded or deleted), `web/lib/auth/route-access.ts` consumers unchanged aside from middleware wiring.
- **Dependencies**: None new; uses existing `@supabase/ssr` and Next.js middleware.
- **Runtime**: One middleware hop on matched routes; session cookies refreshed on navigation as recommended by Supabase for Next.js App Router.
