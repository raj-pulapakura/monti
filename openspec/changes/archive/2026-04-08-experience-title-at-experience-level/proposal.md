## Why

Each experience version currently stores its own `title`, so navigating between versions causes the title in the sandbox header to change — breaking the sense that versions are iterations of the same thing. The title should belong to the experience, not the version, be generated once by the LLM at creation time, and be editable by the user.

## What Changes

- **BREAKING** Drop `title` column from `experience_versions` (DB migration, write path, read path)
- All title reads now come from `experiences.title` (already populated at generation time)
- `createVersion()` no longer inserts a title
- `loadSandboxPreview()`, `getVersionContent()`, and `findBySlug()` read title from `experiences` instead of `experience_versions`
- `VersionContentResponse` drops the `title` field; the frontend no longer updates the title on version switch
- New `PATCH /api/chat/threads/:threadId/title` endpoint allows updating `experiences.title`
- Sandbox header gains a pencil icon next to the experience title; clicking it opens an inline edit input with save/cancel

## Capabilities

### New Capabilities
- `experience-title-editing`: User can edit the experience title inline from the sandbox header via a pencil icon; changes persist to `experiences.title`

### Modified Capabilities
- `experience-persistence`: `experience_versions` no longer stores or writes title; title is written once to `experiences` at generation and never duplicated to versions
- `experience-preview-history`: Version switching no longer updates the displayed title; title is stable across all versions of an experience

## Impact

- **DB**: new migration dropping `experience_versions.title`
- **Backend**: `ExperiencePersistenceRepository.createVersion()`, `ChatRuntimeRepository.loadSandboxPreview()`, `ChatRuntimeRepository.getVersionContent()`, `ExperiencePlayRepository.findBySlug()`, new controller route + repository method for title update
- **Frontend**: `page.tsx` — remove title from version-switch effect, add inline title edit UX in sandbox header
- **Tests**: update any spec/unit tests that seed or assert on `experience_versions.title`
