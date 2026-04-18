## 1. Middleware and shared Supabase edge helper

- [x] 1.1 Add `web/middleware.ts` that creates the cookie-backed Supabase server client from the incoming request, calls `getUser()`, applies cookie `setAll` onto the `NextResponse`, runs `resolveAuthRouteRedirect`, and returns redirect or `NextResponse.next` with merged cookies.
- [x] 1.2 Extract or relocate logic from `web/proxy.ts` into a reusable module (for example under `web/lib/supabase/`) so middleware is the single maintained entry; remove or deprecate the orphan `proxy.ts` export if nothing else imports it.
- [x] 1.3 Configure `middleware` `matcher` to cover `/`, `/chat/:path*`, `/auth`, `/auth/:path*` (and adjust only if required to exclude unintended paths), matching the prior `proxy.ts` intent.

## 2. Server root page and client split

- [x] 2.1 Convert `web/app/page.tsx` into an async Server Component that uses the existing `createSupabaseRouteHandlerClient()` (or renamed server helper), reads session state appropriate for branch + `access_token` (after middleware refresh), and handles missing Supabase env gracefully for props.
- [x] 2.2 Move the current client-only root implementation into a dedicated `"use client"` module; accept typed initial props (`accessToken`, `userId`, optional auth error) and initialize marketing vs home from props instead of defaulting to marketing during auth resolution.
- [x] 2.3 Keep `onAuthStateChange` (and any minimal follow-up `getSession` if needed) so sign-in, sign-out, and token refresh still update the UI after first paint.
- [x] 2.4 If Next disallows cookie writes from the page RSC, harden `setAll` in the server helper per design (no-op or catch) while relying on middleware for refresh.

## 3. Verification

- [x] 3.1 Manually verify: signed-out `/` shows marketing without a misleading loading flash; signed-in `/` and hard refresh show home immediately; `/chat` when signed out redirects to sign-in; signed-in `/sign-in` redirects to `/`.
- [x] 3.2 Run `web` lint/tests if the project’s CI or local script covers touched files.
