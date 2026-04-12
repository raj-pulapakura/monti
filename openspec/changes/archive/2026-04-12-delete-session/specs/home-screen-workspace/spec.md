## MODIFIED Requirements

### Requirement: Display past creations as a searchable infinite-scrolling library grid
The home workspace SHALL show all user threads as a labeled "Library" section rendered as a 4-column grid ordered by most recently updated first. The library SHALL initially render up to 12 cards and SHALL automatically reveal additional 12-card batches as the user scrolls toward the end of the rendered grid. Each card SHALL display a live scaled-down experience preview as its thumbnail and a display title that prefers the latest experience version title with thread title as fallback or secondary context. Threads with no experience content SHALL show a styled empty-state placeholder thumbnail. The library section SHALL include a text search input that filters visible cards client-side by display title. To the left of the search input the library header SHALL render a star icon button that toggles a "favourites only" filter; when active the button SHALL have a visually distinct active state. Each `CreationCard` SHALL render a 3-dot overflow menu button that opens a dropdown with **Rename** and **Delete** actions. Clicking **Delete** opens the `ConfirmModal`; on confirm, the card is optimistically removed from the grid and the delete API is called. Clicking **Rename** navigates to `/chat/:threadId` where the title-edit flow is immediately activated.

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

#### Scenario: Card overflow menu opens
- **WHEN** the user clicks the 3-dot overflow button on a library card
- **THEN** a dropdown appears with Rename and Delete options without triggering card navigation

#### Scenario: Delete card via overflow menu
- **WHEN** the user selects Delete from the card overflow menu and confirms in the modal
- **THEN** the card is removed from the grid immediately and the delete API is called

#### Scenario: Rename card via overflow menu
- **WHEN** the user selects Rename from the card overflow menu
- **THEN** the client navigates to `/chat/:threadId` with the title-edit mode pre-activated
