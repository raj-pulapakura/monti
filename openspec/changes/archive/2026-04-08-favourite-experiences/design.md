## Context

Experiences are user-owned (1 user → many experiences). The `experiences` table already carries user-scoped state (`title`, `archived_at`). Favouriting is a property of an experience, not a separate relationship, so a boolean column is the right fit. The existing `PATCH :threadId/title` endpoint — which resolves the experience via `sandbox_states.experience_id` — is the direct precedent for the new favourite toggle endpoint.

## Goals / Non-Goals

**Goals:**
- Store `is_favourite` on the `experiences` row
- Expose a toggle endpoint following the existing PATCH pattern
- Surface `isFavourite` in thread list and thread hydration responses
- Optimistic UI for star toggle on both surfaces (home card, sandbox header)
- Composable filter: favourites AND search, with distinct empty states

**Non-Goals:**
- Sorting by favourite status (out of scope)
- Bulk favouriting
- Any cross-user favourite visibility

## Decisions

### 1. `is_favourite` on `experiences`, not a join table

Since experiences are user-owned, there is no multi-user ambiguity. A boolean column is simpler, avoids a join, and aligns with how `archived_at` handles soft-deletion on the same table.

_Alternative considered: separate `user_experience_favourites` join table_ — rejected as premature; adds schema complexity with no benefit given the 1-user ownership model.

### 2. Toggle endpoint: `PATCH /api/chat/threads/:threadId/favourite`

Follows the same shape as `PATCH :threadId/title`. The thread ID is the natural API boundary (matches the frontend's context). Internally, the repository resolves `experience_id` from `sandbox_states` and updates `experiences.is_favourite`.

Body: `{ "isFavourite": boolean }` — explicit set rather than blind toggle so the client stays authoritative and retries are idempotent.

_Alternative considered: `PATCH /api/experiences/:experienceId/favourite`_ — would require exposing `experienceId` to the frontend, which currently only knows `threadId`.

### 3. Optimistic update with rollback

On star click the UI flips the state immediately, fires the PATCH in the background, and rolls back on error. This matches user expectation for a lightweight toggle action. Error rollback surfaces a transient banner.

_Alternative considered: wait for server_ — rejected; the title rename pattern does this but favouriting is lower-stakes and the latency would feel sluggish on a star tap.

### 4. AND logic for favourites + search filter

Both filters narrow the set independently. The `filteredThreads` memo chains them: first apply the favourites gate, then apply the search query. This is the conventional mental model and keeps the implementation simple.

### 5. Nested star button inside navigation card

The library cards are `<button>` elements that navigate on click. The star is a nested `<button>` with `e.stopPropagation()`. This is a known pattern and acceptable here; the card area excluding the star still navigates correctly.

## Risks / Trade-offs

- **Stale optimistic state on rapid clicks**: If a user double-taps quickly, two PATCHes could race. Mitigation: debounce or disable the star for the duration of the in-flight request.
- **Migration is additive**: Adding a NOT NULL column with a default is safe on Postgres and poses no downtime risk.
- **`listThreads` query complexity**: The thread list already does multiple joins. Adding `is_favourite` to the experiences select is a trivial column addition, not a new join.

## Migration Plan

1. Deploy migration: `ALTER TABLE experiences ADD COLUMN is_favourite BOOLEAN NOT NULL DEFAULT FALSE`
2. Deploy backend (new endpoint + updated selects) — fully backwards-compatible; existing clients ignore the new field
3. Deploy frontend — reads `isFavourite` from responses, defaults to `false` if absent for safety
4. No rollback complexity: the column defaults to `false`, removing it would only require a follow-up migration if needed

## Open Questions

_None — all decisions resolved during exploration._
