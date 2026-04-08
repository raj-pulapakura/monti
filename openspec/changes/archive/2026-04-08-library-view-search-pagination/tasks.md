## 1. Remove carousel state and logic

- [x] 1.1 Delete `carouselRef`, `canScrollPrev`, `canScrollNext` state and the `updateScrollState` / `handleCarouselStep` logic from `HomeWorkspace`
- [x] 1.2 Remove the `useEffect` that attached scroll and resize listeners to `carouselRef`
- [x] 1.3 Remove the carousel nav buttons (`<` / `>`) from the `home-creations-header` JSX

## 2. Add search and pagination state

- [x] 2.1 Add `searchQuery: string` state (default `""`) to `HomeWorkspace`
- [x] 2.2 Add `currentPage: number` state (default `1`) to `HomeWorkspace`
- [x] 2.3 Add `PAGE_SIZE = 12` constant at module level
- [x] 2.4 Add `filteredThreads` useMemo — case-insensitive substring match of `searchQuery` against `threadCardDisplayTitle(thread)` over the full `threads` array
- [x] 2.5 Add `pagedThreads` useMemo — slice `filteredThreads` by `currentPage` and `PAGE_SIZE`
- [x] 2.6 Add `totalPages` derived value from `Math.ceil(filteredThreads.length / PAGE_SIZE)`
- [x] 2.7 Add `useEffect([searchQuery])` that resets `currentPage` to `1` whenever `searchQuery` changes

## 3. Render the library section header with search input

- [x] 3.1 Rename the section heading from "Recents" to "Library"
- [x] 3.2 Add the search `<input>` to the section header row (right-aligned, placeholder "Search your creations…")
- [x] 3.3 Bind search input `value` to `searchQuery` and `onChange` to `setSearchQuery`
- [x] 3.4 Disable search input while `loadingThreads` is true or `threads.length === 0`

## 4. Replace carousel render with grid render

- [x] 4.1 Replace the `creations-carousel` div with a `library-grid` div using CSS grid (4 columns)
- [x] 4.2 Render `pagedThreads` instead of `threads` in the card map
- [x] 4.3 Add a "no search results" empty state: render "No creations match "{searchQuery}"." when `!loadingThreads && !threadsError && threads.length > 0 && filteredThreads.length === 0`

## 5. Add pagination controls

- [x] 5.1 Add Previous and Next buttons below the grid, bound to `currentPage` decrement/increment
- [x] 5.2 Disable Previous when `currentPage === 1`; disable Next when `currentPage === totalPages`
- [x] 5.3 Render a "Page N of M" label between the buttons
- [x] 5.4 Hide pagination controls entirely when `totalPages <= 1`

## 6. Update CSS

- [x] 6.1 Remove `.creations-carousel`, `.carousel-nav`, `.carousel-nav-button` styles from `globals.css`
- [x] 6.2 Add `.library-grid` CSS grid styles (4 equal columns, consistent row gap matching existing card spacing)
- [x] 6.3 Add `.library-search-input` styles consistent with Sunlit Atelier (matches existing input surface/border tokens)
- [x] 6.4 Add `.library-pagination` styles for the controls row (centered, spaced, muted page indicator label)
