## MODIFIED Requirements

### Requirement: Display past creations as a searchable paginated library grid
The home workspace SHALL show all user threads as a labeled "Library" section rendered as a paginated grid (4 columns × 3 rows, 12 cards per page) ordered by most recently updated first. Each card SHALL display a live scaled-down experience preview as its thumbnail and a display title that prefers the latest experience version title with thread title as fallback or secondary context. Threads with no experience content SHALL show a styled empty-state placeholder thumbnail. The library section SHALL include a text search input that filters visible cards client-side by display title. To the left of the search input the library header SHALL render a star icon button that toggles a "favourites only" filter; when active the button SHALL have a visually distinct active state. The library SHALL show pagination controls below the grid when the filtered result set exceeds one page.

#### Scenario: User has multiple threads
- **WHEN** the home workspace loads for an authenticated user with persisted threads
- **THEN** the system renders a card for each thread ordered by `updatedAt desc`, up to 12 per page

#### Scenario: Thread has a generated experience
- **WHEN** a listed thread has non-null experience content
- **THEN** the card thumbnail renders the live experience preview via scaled iframe

#### Scenario: Thread has no generated experience
- **WHEN** a listed thread has null experience content
- **THEN** the card thumbnail renders a styled empty-state placeholder (no iframe rendered)

#### Scenario: Thread has no title
- **WHEN** a listed thread has a null or empty title
- **THEN** the system renders deterministic fallback subtitle text for that card

#### Scenario: User has no threads
- **WHEN** the authenticated user has no persisted threads
- **THEN** the library area renders an explicit empty state, the search input is rendered but disabled, no pagination controls are shown, and the section remains ready for first creation

#### Scenario: Each library card shows a star icon
- **WHEN** the library grid renders
- **THEN** each card displays a star icon reflecting the experience's current `isFavourite` state

#### Scenario: User stars an experience from a library card
- **WHEN** an authenticated user clicks the star icon on a library card
- **THEN** the star icon immediately reflects the new state (optimistic), a PATCH request is fired, and the card navigation is not triggered

## ADDED Requirements

### Requirement: Favourites-only filter on home library
The library header SHALL render a star icon button to the left of the search input. Activating it SHALL restrict the visible cards to only those with `isFavourite = true`. The filter SHALL compose with the text search query (AND logic). Deactivating it SHALL restore the unfiltered (or search-only) result set.

#### Scenario: User activates the favourites filter with favourited items
- **WHEN** an authenticated user activates the favourites filter and they have at least one favourited experience
- **THEN** only cards with `isFavourite = true` are shown and pagination resets to page 1

#### Scenario: User activates the favourites filter with no favourited items
- **WHEN** an authenticated user activates the favourites filter and they have no favourited experiences
- **THEN** the grid renders the empty state: "No favourited creations yet. Star an experience to save it here."

#### Scenario: Favourites filter and search query are both active with results
- **WHEN** an authenticated user has both the favourites filter active and a non-empty search query
- **THEN** only cards that are both favourited AND match the search query are shown

#### Scenario: Favourites filter and search query are both active with no results
- **WHEN** an authenticated user has the favourites filter active and a search query that matches no favourited experiences
- **THEN** the grid renders the empty state: "No favourited creations match \"{query}\"."

#### Scenario: User deactivates the favourites filter
- **WHEN** an authenticated user deactivates the favourites filter
- **THEN** the grid returns to showing all threads (filtered only by any active search query) and pagination resets to page 1
