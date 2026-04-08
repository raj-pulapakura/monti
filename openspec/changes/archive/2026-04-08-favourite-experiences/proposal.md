## Why

Users have no way to bookmark experiences they want to return to, making it hard to find valued work in a growing library. Favouriting gives users a lightweight curation layer on top of search and pagination.

## What Changes

- Users can star/unstar any experience from the home library card
- Users can star/unstar the active experience from the sandbox header
- A star icon to the left of the library search bar toggles a "favourites only" filter
- The favourites filter composes with the existing search query (AND logic)
- New empty states for: favourites-only with no results, and favourites + search with no results
- `is_favourite` boolean column added to the `experiences` table (default `false`)
- New `PATCH /api/chat/threads/:threadId/favourite` endpoint to toggle the flag
- Thread list and thread hydration responses include `isFavourite`

## Capabilities

### New Capabilities

- `experience-favouriting`: Star/unstar an experience and filter the library to show only favourites

### Modified Capabilities

- `home-screen-workspace`: Library gains a favourites filter toggle and per-card star action
- `library-search-pagination`: Filter logic now composes favourites with search query
- `chat-thread-runtime`: Thread hydration and list responses expose `isFavourite`; new PATCH endpoint added

## Impact

- **Database**: New migration adding `is_favourite` to `experiences`
- **Backend**: `chat-runtime.repository.ts` — listThreads and hydration selects gain `is_favourite`; new PATCH handler and repository method
- **Backend**: `chat-runtime.controller.ts` — new `PATCH :threadId/favourite` route
- **Frontend**: `web/app/page.tsx` — filter toggle, per-card star button, new empty states
- **Frontend**: `web/app/chat/[threadId]/page.tsx` — star button in sandbox header
