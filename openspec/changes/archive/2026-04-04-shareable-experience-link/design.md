## Context

The `experiences` table already has a `slug` column (nullable text, indexed) that has never been populated. The existing sandbox preview endpoint (`GET /api/chat/threads/:threadId/sandbox`) returns the active experience payload to the authenticated frontend. The frontend assembles the full HTML document client-side from `html`, `css`, and `js` fields and renders it in a sandboxed `<iframe srcDoc>`.

All existing backend endpoints are auth-gated via `AuthGuard`, which requires a Bearer token. The Supabase module provides two clients: a request-scoped `SUPABASE_CLIENT` (user JWT, respects RLS) and a singleton `SUPABASE_ADMIN_CLIENT` (service role, bypasses RLS). Public access to experience data must use the admin client — RLS policies are owner-only and there is no anon-read policy on `experiences` or `experience_versions`.

On the frontend, the Next.js proxy middleware matcher covers `/`, `/chat/*`, and `/auth/*` only — `/play/*` is naturally outside the auth gate.

## Goals / Non-Goals

**Goals:**
- Educators can copy a stable public URL for any experience they've generated
- Anyone with the URL can view the experience in a browser without signing in
- The share URL is human-readable (title-derived slug)
- Minimal Monti branding appears on the play page

**Non-Goals:**
- Revocation or expiry of share links
- Access analytics or view counts
- Sharing at the version level (always shows latest version)
- Backfilling slugs for experiences created before this change (pre-launch, acceptable gap)
- Password protection or link-scoped permissions

## Decisions

### 1. Slug format: title-derived + random hex suffix

**Decision**: `{slugified-title-up-to-40-chars}-{6-hex-chars}` (e.g. `photosynthesis-quiz-a1b2c3`)

**Rationale**: Title-derived slugs are readable in shared URLs, which matters when educators paste them into LMS or messages. The 6-char hex suffix (`crypto.randomBytes(3)`) provides 16M possible values per title — collision probability is negligible without a DB uniqueness constraint or retry loop.

**Alternative considered**: Pure random nanoid — simpler but produces opaque URLs that don't convey content.

### 2. Slug assigned at experience creation, not on-demand

**Decision**: Generate and persist slug in `ExperiencePersistenceRepository.createExperience()`.

**Rationale**: Slug is stable for the lifetime of the experience. Assigning at creation avoids a lazy-generation endpoint and keeps the share button simple — it either shows (slug present) or doesn't (null, old experience).

**Alternative considered**: Lazy `POST /api/chat/threads/:threadId/share` that generates a slug on first click — avoids migration concerns but adds a round-trip and network-dependent UX.

### 3. Public endpoint uses SUPABASE_ADMIN_CLIENT

**Decision**: `ExperiencePlayRepository` injects `SUPABASE_ADMIN_CLIENT` (service role) to query `experiences` and `experience_versions` without a user JWT.

**Rationale**: RLS policies are owner-only; no anon-read policy exists. Adding anon RLS policies would widen the trust surface and require a migration. The admin client is already available as a singleton and is the established pattern for server-internal data access.

**Alternative considered**: Add anon SELECT policy to `experiences`/`experience_versions` — simpler query path but permanently widens RLS surface for tables containing user-generated content.

### 4. Play page as Next.js SSR server component

**Decision**: `/play/[slug]` is a React Server Component that fetches experience data at request time and renders an `<iframe srcDoc>` with the assembled HTML document.

**Rationale**: Consistent with Option B explored during design — faster first paint than client-side fetch, cleaner URL, SEO-friendly title metadata via `generateMetadata`. `srcDoc` as an HTML attribute is correctly escaped by React's server renderer and correctly unescaped by the browser.

**Alternative considered**: Backend returns full HTML document and play page redirects — exposes backend URL, loses metadata/branding layer.

### 5. Slug surfaced through existing sandbox preview endpoint

**Decision**: Extend `GET /api/chat/threads/:threadId/sandbox` to include `slug: string | null` alongside the existing experience payload.

**Rationale**: The copy-link button is in the sandbox panel, which already calls this endpoint. One additional parallel query (`experiences.slug` by `experience_id`) avoids a new endpoint and keeps the frontend data model flat.

## Risks / Trade-offs

- **Slug collision**: 16M values per title prefix makes accidental collision negligible. Deliberate collision is possible but there's no security consequence — slugs are public URLs with no ACL.
- **Stale "latest" on play page**: The play page fetches the latest version at request time (`cache: 'no-store'`). If an educator refines an experience, the play URL immediately shows the new version. This is the intended behavior but could surprise students mid-session.
- **Pre-existing null slugs**: Experiences created before this change have `slug = null`. The copy-link button is hidden for these. Educators must generate a new experience to get a shareable link. Acceptable pre-launch.
- **Admin client scope**: Using service role for public reads is correct but means the play endpoint has no per-row access control — it will serve any non-archived experience by slug. This is intentional (public share), but any future "private" experience concept must gate this endpoint.

## Migration Plan

No database migration required — the `slug` column and `idx_experiences_slug` index already exist. The `slug` insert in `createExperience()` is backward-compatible (nullable column, insert simply starts populating it).

Deploy order: backend then frontend (backend endpoint must exist before the play page fetches it).

Rollback: remove the new controller route; the play page 404s gracefully via `notFound()`.
