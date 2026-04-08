## MODIFIED Requirements

### Requirement: Display past creations as a searchable paginated library grid
The home workspace SHALL show all user threads as a labeled "Library" section rendered as a paginated grid (4 columns × 3 rows, 12 cards per page) ordered by most recently updated first. Each card SHALL display a live scaled-down experience preview as its thumbnail and a display title that prefers the latest experience version title with thread title as fallback or secondary context. Threads with no experience content SHALL show a styled empty-state placeholder thumbnail. The library section SHALL include a text search input that filters visible cards client-side by display title, and SHALL show pagination controls below the grid when the filtered result set exceeds one page.

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

## REMOVED Requirements

### Requirement: Display past creations carousel from user thread list
**Reason:** Replaced by the searchable paginated library grid. The horizontal carousel does not scale to large thread counts and provides no discoverability mechanism.
**Migration:** All carousel-specific state (`carouselRef`, `canScrollPrev`, `canScrollNext`, `handleCarouselStep`) and the carousel nav button controls are removed. CSS classes `creations-carousel`, `carousel-nav`, and `carousel-nav-button` are replaced by grid and pagination styles.
