## Context

The `shareable-experience-link` change (2026-04-04) shipped public play URLs at `/play/[slug]` that always resolve to `latest_version_id`. It explicitly listed "sharing at the version level" as a non-goal. The `version-history-sandbox-panel` change (2026-04-07) then gave users the ability to navigate between versions in the sandbox panel via prev/next controls, with `viewingVersionId` tracking which version is pinned.

The gap: when a user is viewing v2 of 5 and clicks "Copy Link", they get a URL that resolves to v5. The creator's view and the shared link are misaligned.

The fix is a thin extension of the existing play infrastructure — no new tables, no new endpoints, just an optional `?v=` query param threaded through frontend → backend.

**Key data already in place:**
- `experience_versions.version_number` (integer, sequential per experience)
- `viewingVersionId` and `viewingVersionNumber` are already computed in `page.tsx` (line 287–291)
- The `allVersions` array already carries `{id, versionNumber, promptSummary}` for all succeeded versions

## Goals / Non-Goals

**Goals:**
- Copy Link produces a version-pinned URL when the user is viewing a non-latest version
- Copy Link produces an unversioned (floating) URL when the user is on the latest version
- The play page resolves `?v=N` to the correct version content
- The copy button tooltip signals which version will be shared

**Non-Goals:**
- Pinning a link to the current latest version (i.e., `/play/slug?v=5` when 5 is latest) — if the creator wants to freeze the current latest, they should navigate to an older version first; this use case is edge-case enough to defer
- Version access control (versions are public once the experience is shared)
- Version deletion or expiry

## Decisions

### 1. URL scheme: `?v=N` (version number, not version ID)

**Decision:** Version-pinned links use `?v=<version_number>` (e.g., `/play/photosynthesis-quiz-a1b2c3?v=2`).

**Rationale:** Version numbers are human-readable integers that appear in the sandbox "vN of M" indicator — the user already thinks in these terms. Using the internal UUID would produce an opaque, 36-char query param. Version numbers are unique per experience (enforced by sequential assignment), so they're a valid lookup key given the slug.

**Alternative considered:** `?version=<uuid>` — direct DB key, but opaque and leaks internal IDs. Rejected.

---

### 2. Unversioned URL stays floating (resolves to latest)

**Decision:** `/play/slug` (no `?v=`) always resolves to `latest_version_id`, exactly as today. Copy Link only appends `?v=N` when `viewingVersionId` corresponds to a non-latest version.

**Rationale:** Two semantically distinct link types — "always latest" and "pinned to version N" — serve different use cases. The floating link is better for ongoing classroom use; the pinned link is better for "share this specific iteration." Preserving the unversioned URL as a floating ref means no behavior change for existing shared links.

**How "latest" is detected:** Compare `viewingVersionId` to `versionList[versionList.length - 1].id`. If they match (or `viewingVersionId` is null), emit the unversioned URL.

---

### 3. Backend lookup for versioned play: slug + version_number

**Decision:** Extend `ExperiencePlayRepository.findBySlug(slug, versionNumber?)`. When `versionNumber` is provided, query `experience_versions` by `experience_id + version_number` (instead of `latest_version_id`). Only `generation_status = 'succeeded'` versions are served.

**Rationale:** The experience is already fetched by slug to get its `id`. A second query filtering `experience_id = <id> AND version_number = N AND generation_status = 'succeeded'` is a clean, index-friendly lookup requiring no schema changes.

**Alternative considered:** Accept version UUID directly in the URL — avoids the two-step lookup but exposes internal IDs and couples the public URL to DB internals.

---

### 4. Controller: `?v=` as optional integer query param

**Decision:** `GET /api/play/:slug?v=<number>` — NestJS `@Query('v')` with `parseInt` validation. Non-integer or negative values return 400. Missing `v` falls back to existing behavior.

**Rationale:** Simple and consistent with REST conventions for optional filters.

---

### 5. Copy button tooltip signals pinned vs. floating

**Decision:** When `viewingVersionId` is pinned to a non-latest version, the copy button tooltip reads "Copy link to v*N*". Otherwise it reads "Copy link" (current behavior).

**Rationale:** A subtle contextual signal prevents confusion without adding UI weight. The user sees "Copy link to v2" and understands the link is pinned — no extra modal or confirmation needed.

## Risks / Trade-offs

- **Version number collision**: Version numbers are unique per experience but not globally unique. The lookup is always `slug → experience_id → version_number`, so no collision risk across experiences.
- **Stale version content on play page**: Version content is immutable once `generation_status = 'succeeded'`. No staleness concern — a pinned `?v=2` link always returns the same content.
- **Play page is client-rendered**: `play-client.tsx` uses `useSearchParams()` for the `?v=` param. This is correct — the play page is already a client component. `generateMetadata` in `page.tsx` receives `searchParams` as a server prop and must pass `v` through to `fetchExperienceTitle`.
- **Non-existent version number**: `GET /api/play/slug?v=99` where v99 doesn't exist → 404. Same as an invalid slug. Acceptable.

## Migration Plan

No database migration. No deployment ordering constraints — the `?v=` param is additive and the backend ignores it gracefully (falling back to latest) if it arrives before the frontend ships. Deploy backend and frontend together.

Rollback: remove `@Query('v')` handling in controller and `versionNumber` branch in repository. Play page falls back to ignoring the param (404 on versioned links, unversioned links unaffected).
