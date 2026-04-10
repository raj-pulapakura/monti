## ADDED Requirements

### Requirement: Incrementally reveal the filtered creation library during scrolling
The library section SHALL initially render the first 12 cards of the filtered result set and SHALL automatically reveal additional 12-card batches when the user scrolls near the end of the currently rendered grid. Infinite scrolling SHALL always operate on the filtered result set, not the raw thread list.

#### Scenario: Filtered results span multiple batches
- **WHEN** the filtered thread list contains more than 12 items
- **THEN** the grid shows the first 12 items and renders a bottom status/sentinel area so additional cards can be revealed automatically

#### Scenario: User reaches the end of the rendered grid
- **WHEN** an authenticated user scrolls to the end of the currently rendered filtered results and additional filtered cards remain
- **THEN** the system appends the next 12 cards to the grid automatically

#### Scenario: All filtered results have been revealed
- **WHEN** the rendered grid already includes every item in the filtered result set
- **THEN** the system does not reveal any further cards and does not render manual pagination controls

#### Scenario: Filtered results fit within the initial batch
- **WHEN** the filtered thread list contains 12 or fewer items
- **THEN** the grid renders all filtered cards without any pagination controls

## MODIFIED Requirements

### Requirement: Filter library cards by text search over display title
The library section SHALL provide a text input that filters the visible creation cards client-side. Filtering SHALL match against each card's display title (preferring `experienceTitle`, falling back to `thread.title`) using a case-insensitive substring match. The full thread list (up to the fetched limit) is always available for filtering regardless of the currently rendered batch. When the favourites filter is also active, text search SHALL apply only within the favourited subset (AND logic). Any search-query change SHALL reset the rendered library feed to its initial 12-card batch for the new filtered result set.

#### Scenario: User types a search query
- **WHEN** an authenticated user types text into the library search input
- **THEN** the grid updates immediately to show only cards whose display title contains the query (case-insensitive), and the rendered feed resets to its first batch

#### Scenario: Search query matches no cards
- **WHEN** the search query does not match any card's display title and the favourites filter is not active
- **THEN** the grid renders the empty state: "No creations match \"{query}\"." and no infinite-scroll status area is shown

#### Scenario: Search query matches no favourited cards
- **WHEN** the search query does not match any favourited card's display title and the favourites filter is active
- **THEN** the grid renders the empty state: "No favourited creations match \"{query}\"." and no infinite-scroll status area is shown

#### Scenario: User clears the search query
- **WHEN** an authenticated user clears the search input (backspace to empty or explicit clear)
- **THEN** the full unfiltered (or favourites-only if active) thread list is shown again and the rendered feed resets to its first batch

#### Scenario: Search input is shown even when library is empty
- **WHEN** an authenticated user has no threads
- **THEN** the search input is rendered but disabled, so the layout remains stable

## REMOVED Requirements

### Requirement: Paginate the filtered creation library
**Reason**: The filtered library is moving from explicit page navigation to automatic infinite scrolling.
**Migration**: Remove page-number state, page indicator text, and `Previous` / `Next` controls, and replace them with first-batch rendering plus scroll-triggered batch growth.
