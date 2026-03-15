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
The system SHALL provide a hydration response that includes thread metadata, ordered messages, current sandbox state, and active runtime metadata for both conversation-loop and generation-engine progression.

#### Scenario: Hydrate populated thread with active tool execution
- **WHEN** the client requests hydration for a thread where a conversation run has an in-flight `generate_experience` invocation
- **THEN** the system returns message history, sandbox state, conversation run metadata, and generation-execution metadata needed for reducer reconciliation

#### Scenario: Hydrate thread with conversation-only execution
- **WHEN** the client requests hydration for a thread where the latest run completed without tool usage
- **THEN** the system returns the persisted assistant message timeline and terminal conversation run status without generation invocation state

### Requirement: Create assistant run per user turn
The system SHALL create a conversation run for each accepted user message and track lifecycle status (`queued`, `running`, `succeeded`, `failed`, `cancelled`) until the conversation model emits terminal output.

#### Scenario: User message accepted
- **WHEN** a user message passes validation and is persisted
- **THEN** the system creates a new conversation run linked to that message with initial status `queued`

#### Scenario: Conversation run succeeds without tools
- **WHEN** the conversation model returns a terminal assistant response without tool calls
- **THEN** the run transitions to `succeeded` and links to the assistant message id

#### Scenario: Conversation run succeeds after generation tool
- **WHEN** a generation tool invocation completes and the conversation model emits final assistant output
- **THEN** the run transitions to `succeeded` only after the post-tool assistant message is persisted

#### Scenario: Conversation run fails
- **WHEN** the conversation loop cannot complete after run creation
- **THEN** the run transitions to `failed` with normalized error metadata

### Requirement: Enforce idempotent message submission
The system MUST support idempotent user message submission using a client-provided idempotency key to prevent accidental duplicate turns.

#### Scenario: Duplicate submit with same key
- **WHEN** the same idempotency key is submitted for the same thread within retention window
- **THEN** the system returns the original result without creating duplicate messages or runs

### Requirement: Publish canonical runtime events
The system SHALL emit canonical runtime events suitable for frontend state reduction across conversation progression, tool lifecycle, and terminal assistant output.

#### Scenario: Conversation run lifecycle stream
- **WHEN** a conversation run transitions through execution states
- **THEN** the event stream emits ordered events including `run_started` and terminal completion/failure events

#### Scenario: Tool-mediated assistant creation stream
- **WHEN** a tool invocation result is consumed and the conversation model persists assistant output
- **THEN** the event stream emits ordered `tool_*` and `assistant_message_created` events for reducer-safe state updates

