## Why

The database stores every refinement as a new `experience_version` row, but the UI only ever shows the latest one. Educators who iterate and get a worse result have no way to see or recover an earlier version — making refinement feel risky instead of safe.

## What Changes

- The `/api/chat/threads/:threadId/sandbox` response is extended to include ordered version metadata (id, version number, prompt summary) for the active experience.
- A new endpoint `GET /api/chat/threads/:threadId/experience-versions/:versionId` returns full content (html/css/js/title) for a specific version, auth-scoped via the thread.
- The sandbox panel header gains prev/next chevron navigation and a "vN of M" version indicator.
- The iframe preview can display any version in the history, independent of the latest-generated version tracked by `sandbox_states`.
- A "New version available" nudge appears when a generation completes while the user is viewing an older version.

## Capabilities

### New Capabilities

_(none — this change adds requirements to an existing capability)_

### Modified Capabilities

- `experience-preview-history`: Add requirements covering version list retrieval, chevron navigation, older-version display, pin/unpin lifecycle, and the new-version nudge.

## Impact

- **Backend**: `chat-runtime.controller.ts`, `chat-runtime.service.ts`, `chat-runtime.repository.ts` — extend sandbox endpoint and add version content endpoint.
- **Frontend**: `web/app/chat/[threadId]/page.tsx` — new state (`viewingVersionId`, `versionList`), version fetch effect, sandbox header nav controls.
- **No DB changes** — `experience_versions` already stores all versions; no new tables or migrations.
- **No breaking changes** — sandbox endpoint response is additive (new `allVersions` field).
