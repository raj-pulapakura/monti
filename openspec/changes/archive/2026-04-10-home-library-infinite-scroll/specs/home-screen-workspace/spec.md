## ADDED Requirements

### Requirement: Display past creations as a searchable infinite-scrolling library grid
The home workspace SHALL show all user threads as a labeled "Library" section rendered as a 4-column grid ordered by most recently updated first. The library SHALL initially render up to 12 cards and SHALL automatically reveal additional 12-card batches as the user scrolls toward the end of the rendered grid. Each card SHALL display a live scaled-down experience preview as its thumbnail and a display title that prefers the latest experience version title with thread title as fallback or secondary context. Threads with no experience content SHALL show a styled empty-state placeholder thumbnail. The library section SHALL include a text search input that filters visible cards client-side by display title. To the left of the search input the library header SHALL render a star icon button that toggles a "favourites only" filter; when active the button SHALL have a visually distinct active state.

#### Scenario: User has multiple threads
- **WHEN** the home workspace loads for an authenticated user with persisted threads
- **THEN** the system renders thread cards ordered by `updatedAt desc`, starting with the first 12 cards and preparing the remaining filtered results for automatic reveal

#### Scenario: User scrolls to the end of the rendered library grid
- **WHEN** additional filtered thread cards remain and the user reaches the end of the currently rendered grid
- **THEN** the system automatically reveals the next 12 cards without requiring a manual pagination action

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
- **THEN** the library area renders an explicit empty state, the search input is rendered but disabled, and no infinite-scroll status row is shown

#### Scenario: Each library card shows a star icon
- **WHEN** the library grid renders
- **THEN** each card displays a star icon reflecting the experience's current `isFavourite` state

#### Scenario: User stars an experience from a library card
- **WHEN** an authenticated user clicks the star icon on a library card
- **THEN** the star icon immediately reflects the new state (optimistic), a PATCH request is fired, and the card navigation is not triggered

## MODIFIED Requirements

### Requirement: Favourites-only filter on home library
The library header SHALL render a star icon button to the left of the search input. Activating it SHALL restrict the visible cards to only those with `isFavourite = true`. The filter SHALL compose with the text search query (AND logic). Activating or deactivating the filter SHALL reset the rendered library feed to its initial 12-card batch for the newly filtered result set.

#### Scenario: User activates the favourites filter with favourited items
- **WHEN** an authenticated user activates the favourites filter and they have at least one favourited experience
- **THEN** only cards with `isFavourite = true` are shown and the library feed resets to its first rendered batch

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
- **THEN** the grid returns to showing all threads (filtered only by any active search query) and the library feed resets to its first rendered batch

## REMOVED Requirements

### Requirement: Display past creations as a searchable paginated library grid
**Reason**: Manual page navigation is being replaced by automatic infinite scrolling for the home Library.
**Migration**: Remove the `Previous` / `Next` controls and page-number label, and replace page-based state with automatic 12-card batch reveal triggered from the bottom of the rendered grid.
