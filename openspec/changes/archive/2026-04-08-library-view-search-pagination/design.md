## Context

The home workspace (`web/app/page.tsx`) renders a horizontally scrollable carousel of the user's past threads. All thread data (up to 1,000 records) is fetched once on mount and held in component state. The carousel is driven by a `carouselRef` and scroll-state booleans (`canScrollPrev`, `canScrollNext`). Card labels use `threadCardDisplayTitle()`, which already prefers `experienceTitle` over `thread.title`.

This change replaces the carousel with a searchable, paginated grid entirely within `HomeWorkspace`. No backend changes are required.

## Goals / Non-Goals

**Goals:**
- Replace the carousel with a 4×3 grid ("Library") that renders up to 12 cards per page
- Add a text search input that filters visible cards by display title, client-side
- Add Previous/Next pagination controls that operate on the filtered result set
- Establish explicit UX rules for how search and pagination interact
- Remove all carousel-specific state and scroll logic

**Non-Goals:**
- Server-side search or server-side pagination (deferred; not needed at current scale)
- Format/type filtering (out of scope per task brief)
- Infinite scroll (pagination is the chosen model)
- Any changes to the thread list API or thread data shape

## Decisions

### 1. Client-side filtering and pagination over the full fetched set

**Decision:** Fetch up to 1,000 threads on mount (unchanged), then derive `filteredThreads` and `pagedThreads` via `useMemo` in the component.

**Rationale:** The existing fetch already loads the full list. Adding a server-side search endpoint would require backend work and a debounced request cycle, adding complexity for a P2 feature. Client-side filtering is instant and sufficient for the projected user cohort (educators with tens to low hundreds of creations).

**Alternative considered:** Server-side pagination with a search query param. Deferred — viable if user libraries grow to thousands.

---

### 2. Search resets pagination to page 1

**Decision:** Whenever `searchQuery` changes (including being cleared), `currentPage` is reset to `1`.

**Rationale:** If a user is on page 3 and types a search query that yields only 5 results, staying on page 3 would show an empty page with no obvious explanation. Resetting to page 1 on every query change is the expected convention and avoids a confusing empty state.

**Implementation:** A single `useEffect([searchQuery])` that calls `setCurrentPage(1)`.

---

### 3. Pagination operates on the filtered result set

**Decision:** `pagedThreads = filteredThreads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)`. Total page count derives from `filteredThreads.length`.

**Rationale:** Users expect pagination to reflect what they searched for, not the raw total. Paginating the unfiltered set while showing filtered cards would produce confusing page counts.

---

### 4. Page size fixed at 12

**Decision:** `PAGE_SIZE = 12` (4 columns × 3 rows).

**Rationale:** Fills a standard desktop viewport (~1200px wide) without overflow. Even spacing at 4 columns matches the existing card width (~220px). Small enough that pagination is meaningful; large enough to provide visual density.

---

### 5. Carousel scroll state removed; nav arrows removed

**Decision:** Remove `carouselRef`, `canScrollPrev`, `canScrollNext`, `handleCarouselStep`, and the `<` `>` nav buttons entirely.

**Rationale:** They have no role in a grid layout. Keeping dead state adds maintenance surface. Pagination controls at the bottom of the grid replace the navigational role of the arrows.

---

### 6. Search input placement

**Decision:** The search input sits in the section header row, right-aligned, beside the "Library" heading — replacing the space previously occupied by the carousel nav buttons.

**Rationale:** Keeps the search visually associated with the library section without pushing content down. The header row already has a justify-between flex layout; the input slots naturally into the right side.

---

### 7. Empty states

Three distinct empty states are required:

| Condition | Message |
|---|---|
| Loading | Skeleton cards + "Gathering your creations..." |
| No creations at all | "No creations yet. Start with one idea above." |
| Search yields no results | "No creations match \"{query}\"." |

The third state is new. It must be distinct from the "no creations" state so users know their library is non-empty and the search is simply too narrow.

## Risks / Trade-offs

**[Risk] 12 iframes rendered simultaneously in the grid vs. lazy-loading in a scrollable carousel**
→ Mitigation: `loading="lazy"` is already set on iframes. All 12 grid cards are in the viewport at once, so lazy loading has less effect than in a carousel. If performance degrades on large libraries, a future iteration can add intersection-observer-based deferred rendering. Acceptable for now.

**[Risk] Client-side search does not find creations beyond the 1,000-record fetch limit**
→ Mitigation: Document this limitation. At the current scale of the product it is not a practical concern. The 1,000-record cap is explicit in the API call and can be raised or replaced with server-side search later.

**[Risk] Page count changes while user is mid-session (new thread created in another tab)**
→ Mitigation: The thread list is only fetched on mount and not reactively updated. This is pre-existing behaviour and out of scope for this change.
