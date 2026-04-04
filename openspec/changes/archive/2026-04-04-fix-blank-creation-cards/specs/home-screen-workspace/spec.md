## MODIFIED Requirements

### Requirement: Display past creations carousel from user thread list
The home workspace SHALL show all user threads as carousel cards ordered by most recently updated first, with a live scaled-down experience preview as the card thumbnail and subtitle text sourced from thread title. Threads with no experience content show a styled empty-state placeholder thumbnail.

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
