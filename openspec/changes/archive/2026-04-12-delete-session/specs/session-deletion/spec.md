## ADDED Requirements

### Requirement: Soft-delete a thread via DELETE API
The system SHALL expose `DELETE /api/chat/threads/:threadId` for authenticated users. The endpoint SHALL assert that the requesting user owns the thread, then set `archived_at = now()` on the `chat_threads` row. The operation SHALL be idempotent — re-deleting an already-archived thread SHALL succeed without error.

#### Scenario: Owner deletes their thread
- **WHEN** an authenticated user calls `DELETE /api/chat/threads/:threadId` for a thread they own
- **THEN** the system sets `archived_at` to the current timestamp and returns `{ ok: true }`

#### Scenario: Non-owner attempts delete
- **WHEN** an authenticated user calls `DELETE /api/chat/threads/:threadId` for a thread they do not own
- **THEN** the system returns a 403 error and does not modify the thread

#### Scenario: Idempotent re-delete
- **WHEN** `DELETE /api/chat/threads/:threadId` is called for a thread that is already archived
- **THEN** the system returns `{ ok: true }` without error

### Requirement: Archived threads are excluded from all list responses
The system SHALL exclude any thread with a non-null `archived_at` from `GET /api/chat/threads` responses.

#### Scenario: Archived thread absent from list
- **WHEN** a user lists their threads after deleting one
- **THEN** the deleted thread does not appear in the response

### Requirement: Confirm before deleting — shared ConfirmModal component
The client SHALL present a `ConfirmModal` before executing any delete operation. The modal SHALL display a title, a message describing the irreversibility, a Cancel button, and a destructive Confirm button. While the delete API call is in-flight, the Confirm button SHALL be disabled and show a loading state. The modal SHALL be dismissible via Cancel or Escape key.

#### Scenario: User cancels delete
- **WHEN** the user opens the delete confirmation modal and clicks Cancel or presses Escape
- **THEN** no API call is made and the modal closes

#### Scenario: User confirms delete — pending state
- **WHEN** the user clicks the Confirm button in the modal
- **THEN** the button enters a disabled loading state while the API call is in-flight

### Requirement: Delete session from library card overflow menu
The `CreationCard` in the home library SHALL render a 3-dot overflow menu button. The menu SHALL contain a **Delete** option. Clicking Delete SHALL open the `ConfirmModal`. On confirm, the thread SHALL be optimistically removed from the library and `DELETE /api/chat/threads/:threadId` called. On API error, the thread SHALL be restored to the library and an error banner shown.

#### Scenario: Overflow menu opens
- **WHEN** the user clicks the 3-dot button on a library card
- **THEN** a dropdown menu appears with Delete and Rename options; clicking the card background does not trigger navigation

#### Scenario: Delete confirmed from library
- **WHEN** the user confirms deletion from the library card menu
- **THEN** the card is immediately removed from the grid and `DELETE /api/chat/threads/:threadId` is called

#### Scenario: Delete fails from library
- **WHEN** the API call returns an error
- **THEN** the card is restored to its original position in the grid and an error banner is shown

### Requirement: Delete session from sandbox header
The `SandboxHeader` SHALL render a Delete button (trash icon) when an active experience is present. Clicking it SHALL open the `ConfirmModal`. On confirm, `DELETE /api/chat/threads/:threadId` SHALL be called; on success the client SHALL navigate to `/`.

#### Scenario: Delete button visible in sandbox
- **WHEN** an active experience is loaded in the sandbox
- **THEN** a trash-icon Delete button is visible in the sandbox header actions bar

#### Scenario: Delete confirmed from sandbox
- **WHEN** the user confirms deletion from the sandbox header
- **THEN** the API call executes and on success the user is redirected to `/`

#### Scenario: Delete button absent when no experience
- **WHEN** no active experience is loaded
- **THEN** no Delete button is rendered in the sandbox header
