## 1. Database Migration

- [x] 1.1 Create migration to drop `title` column from `experience_versions` table

## 2. Backend — Write Path

- [x] 2.1 Remove `title` from the `INSERT` in `ExperiencePersistenceRepository.createVersion()`
- [x] 2.2 Remove `title` from `CreateVersionInput` interface in `experience-persistence.repository.ts`
- [x] 2.3 Update `experience-persistence.repository.spec.ts` to remove any title assertions on version records

## 3. Backend — Read Paths

- [x] 3.1 Update `ChatRuntimeRepository.loadSandboxPreview()` to read `title` from `experiences` (already fetched via `experience_id`) instead of `experience_versions`
- [x] 3.2 Update `ChatRuntimeRepository.getVersionContent()` to read `title` from `experiences` and include it in the return value (sourced from experience, not version) — OR drop `title` from the return entirely and update callers
- [x] 3.3 Update `ExperiencePlayRepository.findBySlug()` to select `title` from the `experiences` query (already fetches `experiences.id` and `latest_version_id`) instead of `experience_versions`
- [x] 3.4 Update `supabase.types.ts` if generated types reference `experience_versions.title`

## 4. Backend — New Title Update Endpoint

- [x] 4.1 Add `updateExperienceTitle({ threadId, userId, title })` method to `ChatRuntimeRepository` that resolves the experience from the thread's sandbox state and updates `experiences.title`
- [x] 4.2 Add `updateExperienceTitle()` method to `ChatRuntimeService` delegating to the repository
- [x] 4.3 Add `PATCH /api/chat/threads/:threadId/title` route to `ChatRuntimeController` with auth guard, request body validation (non-empty string), and response `{ ok: true, data: { title } }`

## 5. Backend — Tests

- [x] 5.1 Update `chat-runtime.service.spec.ts` / `chat-runtime.repository.spec.ts` to remove title from version fixtures and assert title comes from the experience record
- [x] 5.2 Add unit tests for the new `updateExperienceTitle` repository method
- [x] 5.3 Update `rls.integration.spec.ts` if it seeds `experience_versions` with a `title` column

## 6. Frontend — Version Switch

- [x] 6.1 Remove `title` from the `VersionContentResponse` type in `page.tsx`
- [x] 6.2 Remove `title: response.data.title` from the version-switch `useEffect` that calls `setActiveExperience` (title should not change on version switch)

## 7. Frontend — Inline Title Edit UI

- [x] 7.1 Add `isEditingTitle` and `titleDraft` state variables to `ChatThreadPage`
- [x] 7.2 Replace the `<h2>{activeExperience.title}</h2>` with a conditional: display mode shows title + pencil icon; edit mode shows text input + save (✓) + cancel (✕) controls
- [x] 7.3 Implement save handler: call `PATCH /api/chat/threads/:threadId/title`, on success update `activeExperience.title` in local state and exit edit mode, on error revert title and show inline error
- [x] 7.4 Implement cancel handler: exit edit mode, revert `titleDraft` to current title, no API call
- [x] 7.5 Add keyboard support: Enter to save, Escape to cancel in the title input
- [x] 7.6 Block save if `titleDraft.trim()` is empty
- [x] 7.7 Add pencil icon button styling consistent with existing sandbox header controls (use `Pencil` icon from lucide-react)
