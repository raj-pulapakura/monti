## Why

The home-page library currently forces users through explicit page navigation, which interrupts browsing and makes the library feel heavier than the rest of the workspace. Replacing pagination with infinite scrolling keeps the same searchable library model while making large creation lists feel more fluid on desktop and mobile.

## What Changes

- Replace the Library `Previous` / `Next` pagination controls with infinite scrolling that reveals additional thread cards automatically as the user reaches the end of the rendered grid
- Keep the existing client-side search and favourites filters, but reset the rendered window back to the first batch whenever the search query or favourites-only toggle changes
- Add an in-context loading sentinel / status treatment for fetching the next rendered batch and remove the page indicator UI
- Preserve the current thread ordering, card layout, empty states, and full-library client-side filtering model
- Keep the current authenticated thread-list fetch contract (`limit=1000`) and avoid backend API changes for this iteration

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `home-screen-workspace`: Change the home Library requirement from page-based navigation to an infinite-scrolling grid while preserving search, favourites, and current empty/error states
- `library-search-pagination`: Replace page-based filtering/pagination rules with batch-based infinite-scroll rules, including reset behavior when filters change

## Impact

- `web/app/page.tsx` — replace `currentPage` / `pagedThreads` / page controls with visible-count and intersection-observer logic
- `web/app/globals.css` — remove pagination control styles and add infinite-scroll sentinel / status styles
- `openspec/specs/home-screen-workspace/spec.md` — update the home library interaction contract
- `openspec/specs/library-search-pagination/spec.md` — update library search-and-reveal behavior
- No backend changes
- No new dependencies
