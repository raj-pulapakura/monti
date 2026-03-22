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
The home workspace SHALL show all user threads as carousel cards ordered by most recently updated first, with placeholder artwork and subtitle text sourced from thread title.

#### Scenario: User has multiple threads
- **WHEN** the home workspace loads for an authenticated user with persisted threads
- **THEN** the system renders a card for each thread ordered by `updatedAt desc`

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

