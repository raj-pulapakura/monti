## MODIFIED Requirements

### Requirement: Persist thread-centric chat timeline
The system SHALL persist chat conversations as thread-scoped message timelines where each message is immutable, ordered, and attributable to a role (`user`, `assistant`, `tool`, `system`). Streamed in-progress assistant output MUST remain transient runtime state until the assistant turn reaches terminal persistence.

#### Scenario: Create first message in new thread
- **WHEN** a user sends a message without an existing thread id
- **THEN** the system creates a thread and stores the user message in that thread timeline

#### Scenario: Append message to existing thread
- **WHEN** a user sends a message to an existing thread
- **THEN** the system appends the new user message in chronological order without mutating prior messages

#### Scenario: Streamed assistant draft remains transient
- **WHEN** the conversation model emits assistant text before the run completes
- **THEN** the system exposes that text through runtime draft events and does not persist or mutate an assistant chat message until final assistant output is ready

### Requirement: Create assistant run per user turn
The system SHALL create a conversation run for each accepted user message and track lifecycle status (`queued`, `running`, `succeeded`, `failed`, `cancelled`) until the conversation model emits terminal output. The accepted submit response SHALL return the persisted user message and current run metadata without waiting for terminal assistant completion.

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

### Requirement: Publish canonical runtime events
The system SHALL emit canonical runtime events suitable for frontend state reduction across conversation progression, tool lifecycle, streamed assistant drafts, and terminal assistant output. Runtime events MUST remain ordered and replay-safe for thread-scoped reducer reconciliation.

#### Scenario: Conversation run lifecycle stream
- **WHEN** a conversation run transitions through execution states
- **THEN** the event stream emits ordered events including `run_started` and terminal completion/failure events

#### Scenario: Assistant draft stream
- **WHEN** the conversation model emits assistant text before terminal persistence
- **THEN** the event stream emits ordered `assistant_message_started` and `assistant_message_updated` events correlated to the active run with cumulative draft content suitable for reducer replacement

#### Scenario: Terminal assistant persistence stream
- **WHEN** the final assistant message is persisted
- **THEN** the event stream emits `assistant_message_created` after draft updates so the client can reconcile transient draft state with the immutable persisted message timeline

### Requirement: Provide progressive loading feedback for chat and preview
The chat thread workspace SHALL provide staged, visually polished feedback for thread hydration, message submission, streamed assistant drafting, reconnecting, and sandbox preview availability using shared Sunlit Atelier state-feedback patterns.

#### Scenario: Thread hydration is pending
- **WHEN** a valid thread route is loading hydration state
- **THEN** the chat surface shows a dedicated loading treatment with purposeful placeholder structure and avoids blank or ambiguous content regions

#### Scenario: Assistant response is streaming
- **WHEN** a run is active and assistant draft events arrive
- **THEN** the chat surface renders incrementally growing assistant content with a distinctive in-progress presentation while preserving visible runtime progress state

#### Scenario: Preview is not yet available
- **WHEN** no active experience is ready for rendering
- **THEN** the sandbox region shows a purposeful waiting treatment that explains what will appear and when without falling back to raw runtime wording or generic empty chrome

#### Scenario: Live event stream is reconnecting
- **WHEN** thread events temporarily disconnect during an active session
- **THEN** the workspace shows a calm reconnecting treatment that preserves conversation context and communicates recovery without exposing transport-level details

#### Scenario: Message submission is pending
- **WHEN** the user submits a prompt
- **THEN** compose controls reflect short-lived submission acknowledgement state and continue showing run-in-progress state separately until assistant completion

### Requirement: Harmonize chat and sandbox presentation primitives
The chat and sandbox panels SHALL use shared tokenized surface, spacing, motion, and control patterns that preserve hierarchy on both desktop and mobile layouts, including streaming and long-running creation states.

#### Scenario: Desktop workspace layout
- **WHEN** the user views a thread on desktop breakpoints while a response is streaming or a preview is pending
- **THEN** chat and sandbox panels present a unified visual language with clear but cohesive hierarchy

#### Scenario: Mobile workspace layout
- **WHEN** the user views a thread on mobile breakpoints while a response is streaming or a preview is pending
- **THEN** stacked chat and sandbox panels retain the same component styling and state communication semantics as desktop
