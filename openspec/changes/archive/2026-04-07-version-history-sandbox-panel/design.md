## Context

Every refinement creates a new `experience_versions` row with a sequential `version_number`. The `sandbox_states` table always points to the latest generated version (`experience_version_id`). The frontend fetches the current version's content via `GET /api/chat/threads/:threadId/sandbox` and drives the iframe from `activeExperience` state. Currently there is no way to view or navigate to older versions.

The `experience_preview-history` spec exists but has only TBD content — this change populates it with real requirements.

## Goals / Non-Goals

**Goals:**
- Expose ordered version metadata alongside the sandbox state in the existing endpoint
- Let the user navigate to any prior version and view it in the iframe
- Show a nudge when a new version is generated while viewing an older one
- Auth-scope all version content access through the existing thread ownership model

**Non-Goals:**
- Forking / restoring: navigating to v2 does not change `sandbox_states` or make v2 the base for the next refinement
- Version deletion or naming
- Showing diffs between versions
- Persisting the user's last-viewed version across page reloads

## Decisions

### 1. Extend the sandbox endpoint rather than a new versions endpoint

**Decision:** Add `allVersions: [{id, versionNumber, promptSummary}]` to the existing `GET /api/chat/threads/:threadId/sandbox` response.

**Rationale:** The version list is always needed alongside the sandbox state — loading them separately would require an extra round-trip on every page load and every `refreshSandboxPreview` call. The sandbox endpoint already owns the sandbox context; version metadata is naturally co-located.

**Alternative considered:** A separate `GET /api/chat/threads/:threadId/experience-versions` endpoint. Rejected because it adds a second call on every hydration for no benefit.

---

### 2. Lazy-load full version content on navigation

**Decision:** A new endpoint `GET /api/chat/threads/:threadId/experience-versions/:versionId` returns `{title, html, css, js}` only when the user navigates to a specific version.

**Rationale:** html/css/js can be several KB per version. Fetching all content upfront for a user who may have 10 versions wastes bandwidth on data that's rarely accessed. Most sessions will not involve any backwards navigation.

**Alternative considered:** Eager-load all version content in the sandbox endpoint. Rejected due to response size growth proportional to version count.

---

### 3. Auth-scope version content through the thread

**Decision:** The version content endpoint is scoped as `GET /api/chat/threads/:threadId/experience-versions/:versionId`. The backend verifies `thread_id → user_id` before serving version content.

**Rationale:** Reuses the established thread-ownership auth pattern. Avoids exposing a bare `/experience-versions/:versionId` endpoint that would require separate ownership verification logic.

---

### 4. `viewingVersionId: string | null` as pin state

**Decision:** A single nullable state field tracks whether the user is pinned to a specific version. `null` means "follow the latest" (current behavior is preserved).

**Rationale:** Simple and unambiguous. `null` as the default means existing code paths need no changes — only the `viewingVersionId !== null` branch introduces new behaviour.

**Pin lifecycle:**
- Set to `null` on thread route change (reset)
- Set to `null` when user submits a new prompt (auto-show what you just generated)
- Set to a version ID when user clicks prev/next

---

### 5. Nudge on new generation, no auto-jump

**Decision:** When `sandboxState.experienceVersionId` changes while `viewingVersionId !== null`, show a "New version available" affordance. Do not auto-jump.

**Rationale:** Auto-jumping disrupts comparison. The user pinned to an older version did so intentionally; yanking them to the new version without consent is disorienting.

## Risks / Trade-offs

- **Version list goes stale during SSE session** → The version list is fetched as part of `refreshSandboxPreview`. When a new generation completes, `refreshSandboxPreview` is already called (existing behaviour), which will refresh `allVersions` alongside the sandbox state. No additional fetch needed.

- **Content fetch on nav is a round-trip** → Adds ~100–200ms latency on first click to an older version. Acceptable for a deliberate navigational action. Could prefetch on hover if this becomes a complaint.

- **`prompt_summary` truncated at 500 chars** → Sufficient for a tooltip. No risk.

## Open Questions

_(none — all design decisions settled during exploration)_
