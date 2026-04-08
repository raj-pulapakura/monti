## Context

`title` is currently stored on both `experiences` and `experience_versions`. At generation time, `createExperience()` writes the LLM-generated title to `experiences.title` and `createVersion()` also writes it to `experience_versions.title`. All read paths (sandbox preview, version content fetch, public play page) read from `experience_versions.title`. This means switching between versions causes the title in the sandbox header to flicker/change, and it requires the LLM to regenerate a title on every refinement even though the experience identity hasn't changed.

## Goals / Non-Goals

**Goals:**
- Drop `title` from `experience_versions` entirely (DB, write, read)
- All title reads go through `experiences.title`
- Title is generated once by the LLM at create time, never again on refinement
- User can edit the experience title from the sandbox header
- Version switching never updates the displayed title

**Non-Goals:**
- Changing how the slug is generated (slug stays derived from original title, never updated on rename)
- Versioned title history
- Title editing from the public play page

## Decisions

### Drop `title` from `experience_versions` entirely (vs. make nullable)

The proposal called for a clean break. Since `experiences.title` has always been populated alongside `experience_versions.title`, no data is lost. We drop the column directly in a single migration rather than soft-deprecating it. This avoids a two-migration dance and removes dead code immediately.

**Alternative considered**: Make nullable and stop writing. Rejected — it leaves dead weight in the schema and requires a follow-up cleanup migration.

### Title update endpoint lives under thread scope

`PATCH /api/chat/threads/:threadId/title` is preferred over a bare `/api/experiences/:experienceId/title` because:
1. The frontend already has the `threadId` in context (URL param); it does not have the `experienceId` directly.
2. Thread ownership check already exists in the repository; the endpoint can use the same pattern to authorize and then resolve the associated experience.

**Alternative considered**: `PATCH /api/experiences/:experienceId/title` — would require exposing `experienceId` to the frontend, which it currently doesn't track.

### `getVersionContent` drops `title` from its response

The endpoint served `{title, html, css, js}`. Since title no longer lives on the version, it should return `{html, css, js}` only. The frontend should not update `activeExperience.title` on version switch — the title is already loaded at sandbox init time from `loadSandboxPreview` (which reads from `experiences.title`).

### Inline title edit UX: optimistic update with API confirm

The pencil icon in the sandbox header opens an inline input pre-filled with the current title. On submit (Enter or ✓ button), the frontend calls `PATCH /api/chat/threads/:threadId/title` and immediately reflects the new title in local state. On API error, it reverts to the previous title and shows a brief inline error. Cancel (Esc or ✕) reverts without calling the API.

## Risks / Trade-offs

- **Existing data**: Any experience_versions rows that have a `title` value not matching `experiences.title` (e.g., due to refinement regenerating a different title) will lose that per-version title. This is intentional — we want one canonical title.
- **Schema migration on live DB**: `DROP COLUMN` on `experience_versions` requires a deploy-coordinated rollout. Backend must be deployed first (with the column removed from all queries) before the migration drops it, to avoid a window where the app tries to read/write a dropped column.

## Migration Plan

1. **Deploy backend changes first** (remove all reads/writes of `experience_versions.title`)
2. **Run DB migration** (`ALTER TABLE experience_versions DROP COLUMN title`)
3. **Deploy frontend changes** (title edit UI, remove version-switch title update)

Rollback: if the backend is still deployed reading from `experience_versions.title`, just re-run the column addition migration. Because we deploy backend first and the column is still present at that moment, no data loss occurs.

## Open Questions

- Should the title edit be available only when an experience exists, or also in the empty state? (Assumed: only when `activeExperience !== null`)
- Max length for user-edited title? (Assumed: 200 chars, same as current LLM output guidance)
