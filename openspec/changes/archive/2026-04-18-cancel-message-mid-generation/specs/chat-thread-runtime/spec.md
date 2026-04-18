## ADDED Requirements

### Requirement: Emit run_cancelled SSE event on run cancellation
The system SHALL emit a `run_cancelled` runtime event when a run transitions to `cancelled` status. The event SHALL carry the run id in its payload and SHALL be treated as a terminal run event by the frontend reducer.

#### Scenario: Run is cancelled via cancel endpoint
- **WHEN** a run is successfully cancelled
- **THEN** the event stream emits `run_cancelled` with `{ runId }` payload after any partial assistant message events and sandbox rollback events

#### Scenario: Frontend reducer handles run_cancelled
- **WHEN** the frontend reducer receives a `run_cancelled` event
- **THEN** it clears `activeRun` to cancelled status, clears `assistantDraft`, and clears `activeToolInvocation`

## MODIFIED Requirements

### Requirement: Create assistant run per user turn
The system SHALL create a conversation run for each accepted user message and track lifecycle status (`queued`, `running`, `succeeded`, `failed`, `cancelled`) until the conversation model emits terminal output or the user cancels. The accepted submit response SHALL return the persisted user message and current run metadata without waiting for terminal assistant completion. A run in `cancelled` status is a terminal state that does not retry automatically.

#### Scenario: User message accepted
- **WHEN** a user message passes validation and is persisted
- **THEN** the system creates a new conversation run linked to that message with initial status `queued` and returns the accepted user message plus run metadata immediately

#### Scenario: Conversation run succeeds without tools
- **WHEN** the conversation model returns a terminal assistant response without tool calls
- **THEN** the run transitions to `succeeded` and links to the assistant message id

#### Scenario: Conversation run succeeds after generation tool
- **WHEN** a generation tool invocation completes and the conversation model emits final assistant output
- **THEN** the run transitions to `succeeded` only after the post-tool assistant message is persisted

#### Scenario: Conversation run fails
- **WHEN** the conversation loop cannot complete after run creation
- **THEN** the run transitions to `failed` with normalized error metadata

#### Scenario: Conversation run is cancelled
- **WHEN** the user calls the cancel endpoint for an active run
- **THEN** the run transitions to `cancelled`, any partial assistant text is persisted, and the event stream emits `run_cancelled`

### Requirement: Use creator-centered runtime status language
The chat thread workspace SHALL translate runtime and sandbox lifecycle states into concise user-facing creation language. A cancelled run SHALL display a neutral "Reply stopped" label, not an error treatment.

#### Scenario: Experience generation is in progress
- **WHEN** a run, tool invocation, or sandbox build is actively processing
- **THEN** the interface shows a creator-centered in-progress status label rather than internal runtime terminology

#### Scenario: Experience generation fails
- **WHEN** run or sandbox processing reaches a failure state
- **THEN** the interface shows a clear failure state with recovery guidance and preserved retry affordance

#### Scenario: Run is cancelled by user
- **WHEN** a run reaches `cancelled` status
- **THEN** the interface shows a neutral "Reply stopped" label without an error treatment, and the retry composer pre-fills the last user prompt

#### Scenario: Live event stream is reconnecting
- **WHEN** event updates are temporarily disconnected
- **THEN** the interface communicates reconnecting status in user-facing language without exposing transport-level details
