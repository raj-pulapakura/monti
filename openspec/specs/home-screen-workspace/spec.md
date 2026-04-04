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
- **THEN** the system renders the authenticated home workspace with create input and past-creations carousel

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

### Requirement: Display past creations carousel from user thread list
The home workspace SHALL show all user threads as carousel cards ordered by most recently updated first, with a live scaled-down experience preview as the card thumbnail. Card labels SHALL prefer the latest experience version title when available, with thread title as fallback or secondary context. Threads with no experience content show a styled empty-state placeholder thumbnail.

#### Scenario: User has multiple threads
- **WHEN** the home workspace loads for an authenticated user with persisted threads
- **THEN** the system renders a card for each thread ordered by `updatedAt desc`

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
- **THEN** the carousel area renders an explicit empty state and remains ready for first creation

### Requirement: Reopen an existing creation from home carousel
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
- **THEN** the home workspace still renders the create input and thread carousel without a hard error state that prevents starting a new thread

### Requirement: Provide a billing navigation entry point in profile controls
The `FloatingProfileControls` component SHALL include a "Billing & plan" navigation item that links authenticated users to `/billing`. The item MUST appear in the profile dropdown menu alongside the existing sign-out action. This entry point is the primary in-product path for authenticated users to view their billing state, upgrade their plan, or manage their subscription.

#### Scenario: Authenticated user opens profile menu
- **WHEN** an authenticated user opens the profile dropdown in the home workspace or chat view
- **THEN** the menu includes a "Billing & plan" item linking to `/billing`

#### Scenario: User navigates to billing from profile menu
- **WHEN** an authenticated user selects "Billing & plan" from the profile dropdown
- **THEN** the system navigates to `/billing` and the billing workspace renders with the user's current plan and credit state

