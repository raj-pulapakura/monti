## Context

The web app’s `/` route is implemented as a client component that starts in an internal `"loading"` mode but renders `MarketingLanding` for any state other than confirmed `"home"` with a token. Session is therefore resolved only after `useEffect` runs `supabase.auth.getSession()`, causing a visible flash for signed-in users. The repo already has `createSupabaseProxyClient` for cookie-backed `createServerClient` and `createSupabaseRouteHandlerClient` for `next/headers` cookies, plus `resolveAuthRouteRedirect`, but there is no `middleware.ts` wired at the Next root.

## Goals / Non-Goals

**Goals:**

- First paint of `/` matches authenticated vs anonymous state using server-readable session cookies (after refresh where needed).
- No new public URL for the app: marketing and home remain on `/` only.
- Preserve existing redirect rules for `/chat` and auth entry routes; keep client-side `onAuthStateChange` for interactive session updates after load.

**Non-Goals:**

- Splitting marketing and app onto separate routes (for example `/` vs `/app`).
- Replacing Supabase Auth or changing JWT/API security model beyond session read/refresh placement.
- Server-rendering the entire home workspace data graph (thread list can stay client-fetched as today).

## Decisions

1. **Next.js middleware owns session refresh** — Reuse the existing `createSupabaseProxyClient` pattern: call `supabase.auth.getUser()`, merge cookie updates onto `NextResponse.next`, then apply `resolveAuthRouteRedirect`. **Rationale:** Matches Supabase’s recommended Next App Router flow so Server Components and middleware see up-to-date cookies. **Alternative:** Rely only on RSC `getSession` without middleware — rejected because stale cookies and harder refresh semantics.

2. **Thin async Server Component `app/page.tsx`** — Server reads session (for example `getUser()` for identity plus `getSession()` for `access_token` after middleware refresh) and passes a minimal serializable payload to a client `RootPageClient` (name flexible). **Rationale:** Fixes HTML-first branch without reimplementing the large home UI on the server. **Alternative:** Redirect authenticated users to another path — rejected (non-goal).

3. **Client initializes mode from server props** — Replace the implicit `"loading"` → marketing mapping with props-derived initial state; keep `onAuthStateChange` subscription. **Rationale:** Eliminates the flash while preserving reactive auth. **Alternative:** Server-only page with no client subscription — rejected; sign-in/out would be worse.

4. **Single implementation of cookie merge** — Implement middleware by importing shared logic from `lib/supabase` (extract from `proxy.ts` if needed) and delete or shrink `web/proxy.ts` to avoid drift. **Rationale:** One source of truth.

5. **RSC cookie `setAll` behavior** — If Next 16 restricts cookie mutation from the page RSC, use a defensive pattern (no-op or try/catch in `setAll`) for the server page client, relying on middleware for refresh. **Rationale:** Avoids build/runtime failures while keeping middleware as the refresh authority.

## Risks / Trade-offs

- **[Risk] Passing `access_token` from server into client props** expands what appears in the serialized RSC payload (similar exposure to client-held session). → **Mitigation:** Pass only what `HomeWorkspace` needs; treat as equivalent to client session; avoid logging props.

- **[Risk] Middleware matcher too broad** adds latency to static assets. → **Mitigation:** Match only routes that need auth refresh and redirects (aligned with current `proxy.ts` matcher intent, excluding `_next/static` by default Next behavior).

- **[Risk] Session edge race** (server says logged out, client immediately has session). → **Mitigation:** `onAuthStateChange` still promotes to home; rare with consistent cookies.

## Migration Plan

1. Land middleware + server page + client refactor behind normal deploy.
2. Smoke-test: anonymous `/`, authenticated `/` hard refresh, `/chat` when signed out, `/sign-in` when signed in.
3. Rollback: revert middleware and restore single client `page.tsx` if critical issues; no data migration.

## Open Questions

- Exact filename for the extracted client root (`root-page-client.tsx` vs colocated `page-client.tsx`) — resolve during implementation for consistency with `app/` conventions.
