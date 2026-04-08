## 1. Database

- [x] 1.1 Write migration to add `is_favourite BOOLEAN NOT NULL DEFAULT FALSE` to the `experiences` table

## 2. Backend — Repository & Service

- [x] 2.1 Add `toggleFavourite` method to `ExperiencePersistenceRepository` (or `chat-runtime.repository.ts`) that updates `experiences.is_favourite` by experience ID with user ownership check
- [x] 2.2 Add `is_favourite` to the experiences select in `listThreads` and propagate it through to the `ThreadListRow` return type
- [x] 2.3 Add `is_favourite` to the experiences select in thread hydration (`loadSandboxState` / hydration query) and include `isFavourite` in the active experience payload

## 3. Backend — Controller & DTO

- [x] 3.1 Add `parseToggleExperienceFavouriteRequest` DTO validator for `{ isFavourite: boolean }`
- [x] 3.2 Add `PATCH :threadId/favourite` handler in `chat-runtime.controller.ts` following the `PATCH :threadId/title` pattern
- [x] 3.3 Wire controller handler to service/repository toggle method

## 4. Frontend — Types & API

- [x] 4.1 Add `isFavourite: boolean` to the `ThreadCard` type in `web/app/page.tsx`
- [x] 4.2 Add `isFavourite: boolean` to the `ExperiencePayload` type in `web/app/chat/[threadId]/page.tsx`
- [x] 4.3 Add `toggleFavourite(threadId, isFavourite)` helper function that calls `PATCH /api/chat/threads/:threadId/favourite`

## 5. Frontend — Home Library

- [x] 5.1 Add `showFavouritesOnly` state to `HomeWorkspace` and update `filteredThreads` memo to apply favourites + search with AND logic
- [x] 5.2 Add star filter icon button to the library header (left of search input) with active/inactive visual state
- [x] 5.3 Add star icon button to each `creation-card` with `e.stopPropagation()` to prevent card navigation
- [x] 5.4 Implement optimistic toggle on library card star: flip local state immediately, fire PATCH, revert on error with transient error message, disable during in-flight request
- [x] 5.5 Add empty state for favourites-only with no results: "No favourited creations yet. Star an experience to save it here."
- [x] 5.6 Add empty state for favourites + search with no results: "No favourited creations match \"{query}\"."

## 6. Frontend — Sandbox Header

- [x] 6.1 Add `isFavourite` to the `activeExperience` state derived from thread hydration
- [x] 6.2 Add star icon button to the sandbox header (alongside existing Pencil/Link/Expand actions)
- [x] 6.3 Implement optimistic toggle on sandbox header star: same pattern as library card (flip, PATCH, revert on error, disable during in-flight)
- [x] 6.4 Sync sandbox header star state back to the thread list in home (if home is revisited, the list will re-fetch naturally on mount — no extra sync needed)
