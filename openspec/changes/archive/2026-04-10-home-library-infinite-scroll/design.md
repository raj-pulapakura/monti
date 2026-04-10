## Context

The authenticated home workspace in [web/app/page.tsx](/Users/rajpulapakura/Personal%20Code/monti/web/app/page.tsx) currently fetches up to 1,000 thread summaries on mount, filters them client-side for search and favourites, and then slices the filtered array into 12-card pages. The library grid itself is already the right visual structure; the page-number state and `Previous` / `Next` controls are the interaction layer the user wants removed.

The existing search and favourites behavior depends on having the full fetched thread set available client-side. Replacing pagination with true server-driven incremental loading would force a larger contract change around filtering semantics, empty states, and API design. This proposal keeps the current data model and swaps only the reveal model.

## Goals / Non-Goals

**Goals:**
- Replace page-number navigation with infinite scrolling on the home Library
- Preserve the existing 12-card batch size, ordering, search behavior, favourites behavior, and empty/error states
- Keep the implementation local to the current home workspace and CSS, without backend or dependency changes
- Make the reveal behavior work on both desktop and mobile without brittle scroll listeners

**Non-Goals:**
- Server-side pagination, cursor APIs, or server-side search
- Changes to thread-card content, ordering, or favourites persistence
- Virtualization of the full library grid
- Changes to non-home thread-list consumers

## Decisions

### 1. Keep the current full-fetch client-side filtering model

**Decision:** Continue fetching the full user-scoped thread list (`limit=1000`) on mount, then derive filtered and visible subsets entirely in the client.

**Rationale:** Search and favourites already operate over the full fetched list. Preserving that model keeps the change focused on interaction rather than data flow and avoids creating partial-search edge cases where unloaded items cannot match a filter.

**Alternative considered:** Fetch additional pages from the backend as the user scrolls. Rejected for this change because it would either break current client-side filter semantics or require a parallel API/search redesign.

### 2. Reveal cards in 12-card batches with an intersection-observer sentinel

**Decision:** Replace `currentPage` with a `visibleCount` state seeded to `12`, render `filteredThreads.slice(0, visibleCount)`, and place a sentinel element after the grid. When the sentinel enters the viewport and more filtered items remain, increase `visibleCount` by another batch of 12.

**Rationale:** The existing page size already fits the 4 × 3 grid. Reusing that size preserves visual rhythm while removing explicit pagination. `IntersectionObserver` is lighter and less error-prone than window scroll listeners, especially in responsive layouts.

**Alternative considered:** Bind loading to window `scroll` events. Rejected because it is more fragile, noisier to tune, and less aligned with existing project patterns.

### 3. Reset the rendered window whenever search or favourites changes

**Decision:** Any change to `searchQuery` or `showFavouritesOnly` resets `visibleCount` back to the initial 12-card batch.

**Rationale:** This is the infinite-scroll equivalent of the current "reset to page 1" behavior. It prevents users from landing in the middle of a newly filtered list and keeps the beginning of the new result set visible.

**Alternative considered:** Preserve the previous visible count across filter changes. Rejected because it can reveal a large amount of unrelated content after the user narrows or broadens the list.

### 4. Show a lightweight bottom status instead of pagination controls

**Decision:** Remove the `Previous` / `Next` buttons and page label entirely. When more filtered items remain, render a bottom sentinel/status row that supports observer attachment and can communicate "Loading more creations…" while the next batch is being revealed.

**Rationale:** Infinite scroll still needs a stable DOM target and an accessible status surface, but it should not look like a manual control. A dedicated bottom row handles both without introducing new actions.

**Alternative considered:** No visual affordance at all. Rejected because it weakens accessibility and makes the auto-loading behavior harder to understand when users reach the end of the rendered grid.

## Risks / Trade-offs

- [Risk] Rendering more iframed creation cards over time still increases browser work for very large libraries. → Mitigation: the initial render remains capped at 12 cards, and the current library ceiling of 1,000 fetched threads is unchanged.
- [Risk] The observer can fire repeatedly while the sentinel remains in view. → Mitigation: gate batch growth on `hasMore` and reconnect the observer against the latest sentinel after each render step.
- [Risk] Resetting the rendered window on filter changes may feel abrupt if the user is deep in the list. → Mitigation: this mirrors the old page-reset behavior and keeps new filtered results anchored at the start instead of stranding the user mid-list.
