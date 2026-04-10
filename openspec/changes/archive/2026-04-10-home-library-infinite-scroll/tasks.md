## 1. Replace page-based library state with infinite-scroll state

- [x] 1.1 Remove `currentPage`, `pagedThreads`, `totalPages`, and page-button handlers from `web/app/page.tsx`
- [x] 1.2 Add shared batch sizing constants plus `visibleCount` / `visibleThreads` / `hasMoreVisibleThreads` derived state for the filtered library grid
- [x] 1.3 Add a bottom sentinel ref and `IntersectionObserver` effect that increases the rendered batch by 12 when more filtered cards remain
- [x] 1.4 Reset the rendered batch back to the initial 12 cards whenever `searchQuery` or `showFavouritesOnly` changes

## 2. Update the home Library render path

- [x] 2.1 Render `visibleThreads` in the library grid while preserving existing card ordering, preview, and favourite-toggle behavior
- [x] 2.2 Remove the `Previous` / `Next` pagination controls and page label from the Library section
- [x] 2.3 Add an infinite-scroll status/sentinel row below the grid that only appears when more filtered cards remain
- [x] 2.4 Verify the existing empty states still read correctly for no threads, no search matches, and no favourited matches after the batch-reset change

## 3. Refresh Library styling and validation

- [x] 3.1 Remove `.library-pagination` styles from `web/app/globals.css`
- [x] 3.2 Add styles for the infinite-scroll status/sentinel row consistent with the current Sunlit Atelier library surface
- [x] 3.3 Validate the Library flow on desktop and mobile for default browsing, search changes, and favourites-toggle resets
