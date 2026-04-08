# library-search-pagination Specification

## Purpose

Client-side text filtering and pagination over the authenticated user’s creation cards on the home workspace library grid, without server-side search or paging.

## Requirements

### Requirement: Filter library cards by text search over display title
The library section SHALL provide a text input that filters the visible creation cards client-side. Filtering SHALL match against each card's display title (preferring `experienceTitle`, falling back to `thread.title`) using a case-insensitive substring match. The full thread list (up to the fetched limit) is always available for filtering regardless of the current page. When the favourites filter is also active, text search SHALL apply only within the favourited subset (AND logic).

#### Scenario: User types a search query
- **WHEN** an authenticated user types text into the library search input
- **THEN** the grid updates immediately to show only cards whose display title contains the query (case-insensitive), and pagination resets to page 1

#### Scenario: Search query matches no cards
- **WHEN** the search query does not match any card's display title and the favourites filter is not active
- **THEN** the grid renders the empty state: "No creations match \"{query}\"." and no pagination controls are shown

#### Scenario: Search query matches no favourited cards
- **WHEN** the search query does not match any favourited card's display title and the favourites filter is active
- **THEN** the grid renders the empty state: "No favourited creations match \"{query}\"." and no pagination controls are shown

#### Scenario: User clears the search query
- **WHEN** an authenticated user clears the search input (backspace to empty or explicit clear)
- **THEN** the full unfiltered (or favourites-only if active) thread list is shown again and pagination resets to page 1

#### Scenario: Search input is shown even when library is empty
- **WHEN** an authenticated user has no threads
- **THEN** the search input is rendered but disabled, so the layout remains stable

### Requirement: Paginate the filtered creation library
The library section SHALL paginate the filtered result set into pages of 12 cards (4 columns × 3 rows). Pagination controls (Previous, Next, and a "Page N of M" indicator) SHALL appear below the grid only when there is more than one page. Pagination SHALL always operate on the filtered result set, not the raw thread list.

#### Scenario: Filtered results span multiple pages
- **WHEN** the filtered thread list contains more than 12 items
- **THEN** the grid shows the first 12 items and pagination controls appear below with Previous disabled and Next enabled

#### Scenario: User navigates to next page
- **WHEN** an authenticated user activates the Next pagination control
- **THEN** the grid advances by one page, scrolls the library section into view, and the Previous control becomes enabled

#### Scenario: User navigates to previous page
- **WHEN** an authenticated user activates the Previous pagination control on a page greater than 1
- **THEN** the grid retreats by one page and the Next control becomes enabled

#### Scenario: User is on the last page
- **WHEN** the current page is the last page of the filtered result set
- **THEN** the Next pagination control is disabled

#### Scenario: User is on the first page
- **WHEN** the current page is 1
- **THEN** the Previous pagination control is disabled

#### Scenario: Filtered results fit on one page
- **WHEN** the filtered thread list contains 12 or fewer items
- **THEN** no pagination controls are rendered

#### Scenario: Search resets pagination to page 1
- **WHEN** the search query changes (including being cleared)
- **THEN** the current page resets to 1 before the filtered result set is recalculated, so the user always lands on the first page of new results
