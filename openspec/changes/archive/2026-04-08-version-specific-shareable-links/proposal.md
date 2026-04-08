## Why

When a user is viewing an older version of their experience in the sandbox panel and clicks "Copy Link", the copied URL always resolves to the latest version — not the one they're looking at. This creates a mismatch between what the creator sees and what they share.

## What Changes

- The `handleCopyLink()` function encodes `?v=N` in the URL when the user is viewing a non-latest version; unversioned URLs continue to float to latest
- The `/play/[slug]` page reads an optional `?v=` query param and passes it to the API
- The `GET /api/play/:slug` backend endpoint accepts an optional `v` query param (version number) and resolves that specific version instead of `latest_version_id`
- The copy-link button surface subtly signals when a pinned-version URL will be copied (tooltip updates)

## Capabilities

### New Capabilities

_(none — this change extends existing capabilities only)_

### Modified Capabilities

- `experience-sharing`: Extend public play endpoint and copy-link affordance to support optional version pinning via `?v=N`
- `experience-preview-history`: Copy-link behavior is version-aware when the user is navigating version history

## Impact

- **Backend**: `experience-play.controller.ts`, `experience-play.repository.ts` — optional `v` query param, new version lookup path
- **Frontend**: `web/app/chat/[threadId]/page.tsx` (`handleCopyLink`), `web/app/play/[slug]/play-client.tsx`, `web/app/play/[slug]/page.tsx`
- **No DB schema changes** — `version_number` and `experience_id` already exist on `experience_versions`
- **Non-breaking** — unversioned URLs (`/play/slug`) behave identically to today
