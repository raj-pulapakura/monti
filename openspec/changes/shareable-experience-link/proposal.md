## Why

Educators have no way to distribute a generated experience to students — Monti creates but cannot share. The landing page already promises "send a link," making this a pre-launch blocker that completes the core value loop.

## What Changes

- New public route `/play/[slug]` that renders a sandboxed experience iframe without authentication
- "Copy link" button in the sandbox panel (next to the fullscreen button) that copies the shareable URL to clipboard
- New backend endpoint `GET /api/play/:slug` serving experience HTML/CSS/JS publicly via service-role DB access
- Slug generation at experience creation time (title-derived + random hex suffix, e.g. `photosynthesis-quiz-a1b2c3`)
- `slug` field surfaced in the `GET /api/chat/threads/:threadId/sandbox` response so the frontend can construct the share URL

## Capabilities

### New Capabilities

- `experience-sharing`: Public, unauthenticated access to a generated experience via a stable slug-based URL, with minimal Monti branding on the play page

### Modified Capabilities

- `experience-persistence`: Slug is now generated and persisted at experience creation time (previously the `slug` column existed but was never populated)
- `thread-sandbox-sync`: Sandbox preview response now includes the experience `slug` so clients can surface sharing affordances

## Impact

- **Backend**: New `ExperiencePlayController` and `ExperiencePlayRepository` in the `experience` module; `SupabaseModule` added to `ExperienceModule` imports for admin-client access; `ExperiencePersistenceRepository.createExperience()` gains slug generation; `ChatRuntimeRepository.getSandboxPreview()` gains an additional parallel query for the experience slug
- **Frontend**: New SSR server component at `web/app/play/[slug]/page.tsx`; chat thread page gains `slug` field on `ExperiencePayload` and a copy-link button with clipboard feedback
- **No new dependencies**: Slug generation uses Node's built-in `crypto` module
- **No migration needed**: The `slug` column and its index already exist in the `experiences` table
