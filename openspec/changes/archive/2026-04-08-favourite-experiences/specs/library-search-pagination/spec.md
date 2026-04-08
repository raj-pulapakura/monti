## MODIFIED Requirements

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
