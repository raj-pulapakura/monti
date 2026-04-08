## ADDED Requirements

### Requirement: User can edit the experience title inline from the sandbox header
The client SHALL display a pencil (edit) icon adjacent to the experience title in the sandbox header whenever an active experience is present. Clicking the icon SHALL replace the title display with an inline text input pre-filled with the current title, along with save (✓) and cancel (✕) controls. Submitting the new title SHALL call `PATCH /api/chat/threads/:threadId/title` and immediately reflect the change in local state. Cancelling SHALL revert the input to the previous title without a network call.

#### Scenario: Pencil icon visible when experience is active
- **WHEN** the sandbox panel has an active experience loaded
- **THEN** a pencil/edit icon is rendered next to the experience title `<h2>`

#### Scenario: Pencil icon not visible when no experience
- **WHEN** no active experience is present in the sandbox panel
- **THEN** no pencil/edit icon is rendered

#### Scenario: Clicking pencil enters edit mode
- **WHEN** the user clicks the pencil icon
- **THEN** the title `<h2>` is replaced by a text input pre-filled with the current title, and save (✓) and cancel (✕) controls appear

#### Scenario: Save commits the new title
- **WHEN** the user modifies the title text and clicks ✓ or presses Enter
- **THEN** the client calls `PATCH /api/chat/threads/:threadId/title` with the new title, exits edit mode, and displays the updated title in the header

#### Scenario: Cancel reverts without saving
- **WHEN** the user clicks ✕ or presses Escape during edit mode
- **THEN** the client exits edit mode, the title reverts to its previous value, and no network call is made

#### Scenario: API error reverts title and shows feedback
- **WHEN** the `PATCH /api/chat/threads/:threadId/title` call fails
- **THEN** the title reverts to the value it had before editing and a brief error is shown inline

#### Scenario: Empty title is rejected client-side
- **WHEN** the user clears the title input and attempts to save
- **THEN** the save action is blocked and no API call is made

### Requirement: Backend exposes endpoint to update experience title
The backend SHALL expose `PATCH /api/chat/threads/:threadId/title` (authenticated) that accepts `{ title: string }`, verifies the thread belongs to the authenticated user, resolves the associated experience, and updates `experiences.title`. It SHALL return the updated title in the response.

#### Scenario: Valid title update succeeds
- **WHEN** an authenticated user sends `PATCH /api/chat/threads/:threadId/title` with a non-empty title string and the thread belongs to them
- **THEN** the backend updates `experiences.title` and returns `{ ok: true, data: { title: string } }`

#### Scenario: Title update rejected for unowned thread
- **WHEN** the authenticated user sends the request for a thread they do not own
- **THEN** the backend returns a validation error and does not update the title

#### Scenario: Empty or missing title is rejected
- **WHEN** the request body has an empty or missing `title` field
- **THEN** the backend returns a validation error
