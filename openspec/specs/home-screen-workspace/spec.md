# home-screen-workspace Specification

## Purpose
TBD - created by archiving change home-screen-thread-routing. Update Purpose after archive.
## Requirements
### Requirement: Render session-aware home workspace at root route
The web application SHALL treat `/` as a session-aware home entrypoint: unauthenticated users see marketing content and authenticated users see the home workspace. For any full document navigation to `/` (including first load and hard refresh), the system SHALL resolve authenticated state using server-readable Supabase session material before choosing whether to emit marketing or the home workspace as the primary document content for that route, so that a user with a valid session is not shown only the marketing landing as the initial resolved root experience.

#### Scenario: Unauthenticated visitor opens root route
- **WHEN** a visitor without a valid session requests `/`
- **THEN** the system renders the marketing landing page

#### Scenario: Authenticated user opens root route
- **WHEN** a user with a valid session requests `/`
- **THEN** the system renders the authenticated home workspace with create input and past-creations library

#### Scenario: Authenticated user hard-refreshes root route
- **WHEN** a user with a valid session performs a full document navigation to `/` (including hard refresh)
- **THEN** the initial HTML response does not present the marketing landing page as the chosen authenticated root experience

### Requirement: Start a new chat thread from home create input
The system SHALL create a chat thread and transition to `/chat/<threadId>` when the authenticated user submits a non-empty prompt from home.

#### Scenario: Successful create submission from home
- **WHEN** an authenticated user submits a non-empty prompt in the home create input
- **THEN** the system creates a thread, navigates to `/chat/<threadId>`, and submits the handed-off prompt exactly once

#### Scenario: Empty create submission is rejected client-side
- **WHEN** the create input is empty or whitespace-only
- **THEN** the system does not create a thread and does not navigate away from home

#### Scenario: Home create submission fails
- **WHEN** thread creation or initial prompt submission fails
- **THEN** the system keeps the user on a recoverable UI state and shows an error without losing control of navigation state

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

### Requirement: Reopen an existing creation from the home library
The home workspace SHALL allow users to reopen prior creations by selecting a thread card.

#### Scenario: User selects a creation card
- **WHEN** an authenticated user clicks a past-creation card
- **THEN** the system navigates to `/chat/<threadId>` for the selected thread and hydrates that thread runtime

### Requirement: Present home workspace with Sunlit Atelier hierarchy
The home workspace SHALL use the shared Sunlit Atelier visual hierarchy for heading treatment, creation input, actions, and creation cards.

#### Scenario: Authenticated user opens home workspace
- **WHEN** an authenticated user loads `/`
- **THEN** the home workspace renders using shared tokenized surfaces, typography roles, and action styling defined by the design language

#### Scenario: Unauthenticated user opens landing view
- **WHEN** an unauthenticated user loads `/`
- **THEN** the marketing landing view uses the same design language primitives and does not introduce a conflicting visual style system

### Requirement: Provide polished thread list state transitions on home
The home workspace SHALL present dedicated loading, empty, and error states for the past-creations region using concise creator-centered language.

#### Scenario: Thread list is loading
- **WHEN** the authenticated home workspace is fetching thread summaries
- **THEN** the interface renders a loading placeholder state for creation cards and clear in-context loading copy

#### Scenario: Thread list is empty
- **WHEN** the authenticated user has no threads
- **THEN** the interface renders an explicit empty state that encourages first creation

#### Scenario: Thread list request fails
- **WHEN** loading the thread list fails
- **THEN** the interface renders a recoverable error state within the home workspace context

### Requirement: Communicate create submission progress with unified controls
The home create form SHALL use shared interaction-state styling and MUST prevent duplicate create submissions while a create request is in flight.

#### Scenario: Create request is submitted
- **WHEN** a user submits a valid non-empty create prompt
- **THEN** the submit control reflects in-progress state using shared loading treatment and prevents duplicate submissions

#### Scenario: Create request fails
- **WHEN** thread creation fails
- **THEN** the interface restores the form to an interactive state and shows a recoverable error message

### Requirement: Show billing summary on authenticated home workspace

The authenticated home workspace SHALL request the billing summary from `GET /api/billing/me` when billing is enabled and SHALL display the effective plan label, remaining included credits, remaining top-up credits (when non-zero), and per-tier credit costs for `fast` and `quality` without blocking thread creation.

#### Scenario: Authenticated home loads billing strip

- **WHEN** an authenticated user loads `/` and billing is enabled
- **THEN** the workspace renders a visible billing summary showing plan label, included credits, and fast/quality costs

#### Scenario: Paid user has top-up credits

- **WHEN** an authenticated paid-plan user loads `/` and `topupCreditsAvailable` is greater than zero
- **THEN** the billing strip also displays the available top-up credit count

#### Scenario: Billing off or request failure does not break home

- **WHEN** billing is disabled or the billing summary request fails
- **THEN** the home workspace still renders the create input and creation library without a hard error state that prevents starting a new thread

### Requirement: Provide a billing navigation entry point in profile controls
The `FloatingProfileControls` component SHALL include a "Billing & plan" navigation item that links authenticated users to `/billing`. The item MUST appear in the profile dropdown menu alongside the existing sign-out action. This entry point is the primary in-product path for authenticated users to view their billing state, upgrade their plan, or manage their subscription.

#### Scenario: Authenticated user opens profile menu
- **WHEN** an authenticated user opens the profile dropdown in the home workspace or chat view
- **THEN** the menu includes a "Billing & plan" item linking to `/billing`

#### Scenario: User navigates to billing from profile menu
- **WHEN** an authenticated user selects "Billing & plan" from the profile dropdown
- **THEN** the system navigates to `/billing` and the billing workspace renders with the user's current plan and credit state

### Requirement: Offer rotating example prompt starters on authenticated home

The authenticated home workspace SHALL display exactly three clickable example prompt controls adjacent to the primary create input. The visible prompts SHALL be selected from a client-defined pool larger than three using a deterministic algorithm that depends on the signed-in user’s stable identifier and the current calendar day in UTC, such that the same user sees the same three prompts for the entire UTC day and may see different prompts on a subsequent UTC day. The controls SHALL be visible whenever the authenticated home workspace is shown, without requiring an empty thread list or first-time visit.

#### Scenario: Authenticated user sees three starters

- **WHEN** an authenticated user loads the home workspace
- **THEN** the interface renders exactly three example prompt controls near the create input

#### Scenario: Clicking a starter fills the create input

- **WHEN** an authenticated user activates one of the example prompt controls
- **THEN** the home create input is set to that prompt’s full text and is focused or otherwise ready for the user to edit or submit

#### Scenario: Starters do not submit the create form by themselves

- **WHEN** an authenticated user activates an example prompt control
- **THEN** the system does not submit the create form solely as a result of that activation

#### Scenario: Deterministic rotation within a UTC day

- **WHEN** the same authenticated user reloads or revisits the home workspace multiple times within the same UTC calendar day
- **THEN** the same three example prompts are shown each time (assuming the same pool version in the deployed client)

#### Scenario: Starters are not shown on unauthenticated landing

- **WHEN** a visitor without a valid session views the marketing landing on `/`
- **THEN** the example prompt starter controls for the authenticated home create flow are not shown

### Requirement: Style example prompt starters with Sunlit Atelier

Example prompt controls SHALL use the same design language tokens and hierarchy as the home create region (surfaces, typography, focus rings) and SHALL not introduce a conflicting control style.

#### Scenario: Authenticated home shows starters

- **WHEN** the authenticated home workspace renders the example prompt controls
- **THEN** their visual treatment is consistent with Sunlit Atelier patterns used by the home create form

### Requirement: Example starters align generation mode when specified

Each example prompt entry MAY specify a default generation mode (`auto`, `fast`, or `quality`). When the user activates a starter that specifies a mode, the home create form SHALL set its generation mode control to that value in addition to filling the create input with the prompt text.

#### Scenario: Starter sets generation mode

- **WHEN** an authenticated user activates an example prompt control associated with a generation mode
- **THEN** the generation mode selector reflects that mode and the create input contains the starter’s full prompt text

