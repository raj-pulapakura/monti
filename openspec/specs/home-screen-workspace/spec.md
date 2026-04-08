# home-screen-workspace Specification

## Purpose
TBD - created by archiving change home-screen-thread-routing. Update Purpose after archive.
## Requirements
### Requirement: Render session-aware home workspace at root route
The web application SHALL treat `/` as a session-aware home entrypoint: unauthenticated users see marketing content and authenticated users see the home workspace.

#### Scenario: Unauthenticated visitor opens root route
- **WHEN** a visitor without a valid session requests `/`
- **THEN** the system renders the marketing landing page

#### Scenario: Authenticated user opens root route
- **WHEN** a user with a valid session requests `/`
- **THEN** the system renders the authenticated home workspace with create input and past-creations library

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

