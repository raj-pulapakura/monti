## Why

The current "Recents" carousel becomes effectively unusable once a user has more than ~20 creations — there is no way to find a specific creation without scrolling through the entire list. Replacing the carousel with a searchable, paginated library grid makes the product viable for prolific educators long-term.

## What Changes

- The "Recents" carousel section is replaced by a "Library" section rendered as a 4×3 grid
- A text search input is introduced above the grid, filtering thread cards client-side by display title
- Pagination controls (Previous / Next + page indicator) replace the carousel scroll arrows
- Page size is fixed at 12 cards per page
- Searching resets pagination to page 1
- The carousel left/right scroll buttons are removed
- No backend API changes required — all data is already fetched client-side (up to 1,000 threads)

## Capabilities

### New Capabilities

- `library-search-pagination`: Text search and pagination over the authenticated user's creation library on the home screen

### Modified Capabilities

- `home-screen-workspace`: The past-creations display requirement changes from a horizontally scrollable carousel to a searchable paginated grid ("Library"). Specific scenario changes: card ordering, empty states, and layout behavior are all affected.

## Impact

- `web/app/page.tsx` — `HomeWorkspace` component: replace carousel render branch and state with grid + search + pagination state
- `web/app/globals.css` — remove carousel-specific styles; add grid, search input, and pagination control styles
- No backend changes
- No new dependencies
