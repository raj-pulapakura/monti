# chat-thread-runtime Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Persist thread-centric chat timeline
The system SHALL persist chat conversations as thread-scoped message timelines where each message is immutable, ordered, and attributable to a role (`user`, `assistant`, `tool`, `system`).

#### Scenario: Create first message in new thread
- **WHEN** a user sends a message without an existing thread id
- **THEN** the system creates a thread and stores the user message in that thread timeline

#### Scenario: Append message to existing thread
- **WHEN** a user sends a message to an existing thread
- **THEN** the system appends the new user message in chronological order without mutating prior messages

### Requirement: Provide thread hydration API for frontend bootstrap
The system SHALL provide a hydration response that includes thread metadata, ordered messages, current sandbox state, and active run metadata needed to render the chat+sandbox workspace.

#### Scenario: Hydrate populated thread
- **WHEN** the client requests hydration for a thread with prior activity
- **THEN** the system returns thread details, message history, sandbox state, and any in-flight run status in a single response contract

#### Scenario: Hydrate empty thread
- **WHEN** the client requests hydration for a new or empty thread
- **THEN** the system returns an empty message list and sandbox state of `empty`

### Requirement: Create assistant run per user turn
The system SHALL create a new assistant run for each accepted user message and track run lifecycle status (`queued`, `running`, `succeeded`, `failed`, `cancelled`).

#### Scenario: User message accepted
- **WHEN** a user message passes validation and is persisted
- **THEN** the system creates an assistant run linked to that message with initial status `queued`

#### Scenario: Assistant run succeeds
- **WHEN** orchestration completes and final assistant output is produced
- **THEN** the run status transitions to `succeeded` and links to the assistant message id

#### Scenario: Assistant run fails
- **WHEN** orchestration errors after run creation
- **THEN** the run status transitions to `failed` with normalized error metadata

### Requirement: Enforce idempotent message submission
The system MUST support idempotent user message submission using a client-provided idempotency key to prevent accidental duplicate turns.

#### Scenario: Duplicate submit with same key
- **WHEN** the same idempotency key is submitted for the same thread within retention window
- **THEN** the system returns the original result without creating duplicate messages or runs

### Requirement: Publish canonical runtime events
The system SHALL emit canonical runtime events suitable for frontend state reduction independent of provider-specific response formats.

#### Scenario: Run lifecycle stream
- **WHEN** a run transitions through execution states
- **THEN** the event stream emits ordered events including at minimum `run_started` and terminal completion/failure events

#### Scenario: Assistant message creation stream
- **WHEN** final assistant output is persisted
- **THEN** the event stream emits `assistant_message_created` containing the new message identifier and render-ready content

