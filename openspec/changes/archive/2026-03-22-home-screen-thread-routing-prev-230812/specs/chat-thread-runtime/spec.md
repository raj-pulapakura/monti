## ADDED Requirements

### Requirement: Provide authenticated thread list API for home workspace
The system SHALL provide an authenticated, user-scoped thread-listing API that returns thread summary metadata for home-screen creation cards.

#### Scenario: List threads for authenticated owner
- **WHEN** an authenticated user requests the thread list
- **THEN** the system returns only that user's threads ordered by most recent `updated_at` first

#### Scenario: Include all user threads in list response
- **WHEN** a user has threads in mixed runtime/sandbox states
- **THEN** the list response includes all threads regardless of sandbox readiness

#### Scenario: Unauthenticated thread list request
- **WHEN** a thread-list request is made without a valid authenticated user
- **THEN** the system rejects the request as unauthorized

### Requirement: Seed thread title from first accepted user prompt
The system SHALL set `chat_threads.title` from the first accepted user message snippet when a thread has no title, and SHALL preserve that title on subsequent turns.

#### Scenario: First user message seeds untitled thread
- **WHEN** a user submits the first accepted message to a thread with null title
- **THEN** the system writes a normalized snippet of that prompt to `chat_threads.title`

#### Scenario: Existing thread title is not overwritten
- **WHEN** a user submits additional messages to a thread that already has a title
- **THEN** the system leaves `chat_threads.title` unchanged

#### Scenario: Explicitly titled thread remains stable
- **WHEN** a thread was created with an explicit title and receives its first user message
- **THEN** the system does not replace the explicit title with prompt-derived text

## MODIFIED Requirements

### Requirement: Enforce authenticated ownership for thread runtime operations
The system MUST scope chat thread creation, listing, hydration, message submission, sandbox preview, and runtime event streaming to the authenticated thread owner.

#### Scenario: Authenticated owner accesses thread runtime
- **WHEN** an authenticated user requests runtime operations for a thread they own
- **THEN** the system allows access and returns only records owned by that user

#### Scenario: Cross-user thread access attempt
- **WHEN** an authenticated user requests runtime operations for a thread owned by a different user
- **THEN** the system rejects the request and does not expose thread metadata, messages, sandbox state, or events
