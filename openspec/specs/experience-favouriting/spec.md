# experience-favouriting Specification

## Purpose

User-owned favourite flag on experiences: persistence, thread-scoped API to set it, and optimistic star interactions in the library and sandbox.

## Requirements

### Requirement: Store favourite flag on experience
The system SHALL persist an `is_favourite` boolean column on the `experiences` table, defaulting to `false`. Because experiences are user-owned, this column is authoritative for the owning user with no additional scoping required.

#### Scenario: Experience created
- **WHEN** a new experience row is inserted
- **THEN** `is_favourite` defaults to `false`

### Requirement: Toggle favourite via thread-scoped PATCH endpoint
The system SHALL expose `PATCH /api/chat/threads/:threadId/favourite` accepting `{ "isFavourite": boolean }`. The endpoint SHALL resolve the experience from the thread's active sandbox state and update `experiences.is_favourite` to the supplied value. The endpoint SHALL enforce user ownership — requests for threads not owned by the authenticated user SHALL return a not-found or authorisation error.

#### Scenario: User favourites an experience
- **WHEN** an authenticated user sends `PATCH /api/chat/threads/:threadId/favourite` with `{ "isFavourite": true }`
- **THEN** the system sets `is_favourite = true` on the associated experience and returns `{ ok: true, data: { isFavourite: true } }`

#### Scenario: User unfavourites an experience
- **WHEN** an authenticated user sends `PATCH /api/chat/threads/:threadId/favourite` with `{ "isFavourite": false }`
- **THEN** the system sets `is_favourite = false` on the associated experience and returns `{ ok: true, data: { isFavourite: false } }`

#### Scenario: Thread has no active experience
- **WHEN** the thread's sandbox state has no associated experience
- **THEN** the system returns a validation error

#### Scenario: Thread belongs to a different user
- **WHEN** a user sends a PATCH request for a thread not owned by them
- **THEN** the system returns a not-found or authorisation error and does not modify any experience

### Requirement: Optimistic favourite toggle in the UI
Both the home library card and the sandbox header star button SHALL apply the toggled state to the local UI immediately on click without waiting for the server response. If the server request fails, the system SHALL revert the UI to the pre-click state and display a transient error message.

#### Scenario: Successful optimistic toggle
- **WHEN** a user clicks the star button on a library card or sandbox header
- **THEN** the star icon reflects the new state immediately, the PATCH request fires in the background, and on success the local state is confirmed

#### Scenario: Server error on toggle
- **WHEN** the PATCH request fails after an optimistic update
- **THEN** the star icon reverts to its pre-click state and a transient error message is shown

#### Scenario: Rapid successive clicks are debounced
- **WHEN** a user clicks the star button multiple times before the in-flight request completes
- **THEN** the star button is disabled for the duration of the in-flight request to prevent concurrent conflicting requests
