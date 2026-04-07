## 1. Backend — Extend sandbox endpoint with version list

- [x] 1.1 Add `allVersions` query to `getSandboxPreview` in `chat-runtime.repository.ts`: fetch all `succeeded` versions for the active `experience_id`, ordered by `version_number` asc, selecting `id`, `version_number`, `prompt_summary`
- [x] 1.2 Update the `getSandboxPreview` return type and service layer to include `allVersions: {id: string, versionNumber: number, promptSummary: string}[]`
- [x] 1.3 Update `GET :threadId/sandbox` controller response to expose `allVersions` in `data`

## 2. Backend — New version content endpoint

- [x] 2.1 Add `parseVersionContentRequest` to `chat-runtime.dto.ts` — validates `threadId` and `versionId` as UUIDs
- [x] 2.2 Add `getVersionContent` method to `chat-runtime.repository.ts`: verify thread ownership, verify the version belongs to the thread's sandbox experience, return `{title, html, css, js}`
- [x] 2.3 Add `getVersionContent` to `chat-runtime.service.ts`
- [x] 2.4 Add `GET :threadId/experience-versions/:versionId` route to `chat-runtime.controller.ts`

## 3. Frontend — State and data fetching

- [x] 3.1 Add `VersionMeta` type `{id: string, versionNumber: number, promptSummary: string}` and update `SandboxPreviewResponse` to include `allVersions: VersionMeta[]`
- [x] 3.2 Add `versionList` state (`VersionMeta[]`) and `viewingVersionId` state (`string | null`) to the chat page component
- [x] 3.3 Populate `versionList` from the sandbox preview response in `refreshSandboxPreview`
- [x] 3.4 Reset `viewingVersionId` to `null` and `versionList` to `[]` on thread route change (alongside existing reset logic)
- [x] 3.5 Reset `viewingVersionId` to `null` on prompt submit (alongside existing submit logic)
- [x] 3.6 Add a `useEffect` that fetches full version content from `/api/chat/threads/:threadId/experience-versions/:versionId` when `viewingVersionId` is non-null, and updates `activeExperience` with the fetched content

## 4. Frontend — Version navigation UI

- [x] 4.1 Add `ChevronLeft` and `ChevronRight` to lucide-react imports
- [x] 4.2 Derive `viewingVersionNumber`: when `viewingVersionId` is set use the matching version from `versionList`; otherwise use the version number of `sandboxState.experienceVersionId`
- [x] 4.3 Render version nav controls in the sandbox header when `versionList.length > 1`: prev button, "vN of M" label with `title` tooltip showing `promptSummary`, next button
- [x] 4.4 Disable prev button when on version 1; disable next button when on the latest version
- [x] 4.5 Wire prev/next click handlers to set `viewingVersionId` to the adjacent version's id

## 5. Frontend — New version nudge

- [x] 5.1 Add a `useEffect` that detects when `sandboxState.experienceVersionId` changes while `viewingVersionId` is non-null, and sets a `newVersionAvailable` boolean state
- [x] 5.2 Render a "New version available" banner/button in the sandbox panel when `newVersionAvailable` is true
- [x] 5.3 Wire the nudge interaction to reset `viewingVersionId` to `null` and clear `newVersionAvailable`
