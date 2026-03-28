# chat-thread-runtime Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
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

### Requirement: Provide thread hydration API for frontend bootstrap
The system SHALL provide a hydration response that includes thread metadata, ordered messages, current sandbox state, and active runtime metadata for both conversation-loop and generation-engine progression.

#### Scenario: Hydrate populated thread with active tool execution
- **WHEN** the client requests hydration for a thread where a conversation run has an in-flight `generate_experience` invocation
- **THEN** the system returns message history, sandbox state, conversation run metadata, and generation-execution metadata needed for reducer reconciliation

#### Scenario: Hydrate thread with conversation-only execution
- **WHEN** the client requests hydration for a thread where the latest run completed without tool usage
- **THEN** the system returns the persisted assistant message timeline and terminal conversation run status without generation invocation state

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

### Requirement: Enforce idempotent message submission
The system MUST support idempotent user message submission using a user-scoped idempotency key to prevent accidental duplicate turns.

#### Scenario: Duplicate submit with same key by same user and thread
- **WHEN** the same idempotency key is submitted by the same authenticated user for the same thread within retention window
- **THEN** the system returns the original result without creating duplicate messages or runs

#### Scenario: Duplicate key from different user scope
- **WHEN** an idempotency key value matches a key used by a different authenticated user
- **THEN** the system treats it as a distinct scope and does not deduplicate across users

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

### Requirement: Enforce authenticated ownership for thread runtime operations
The system MUST scope chat thread creation, listing, hydration, message submission, sandbox preview, and runtime event streaming to the authenticated thread owner.

#### Scenario: Authenticated owner accesses thread runtime
- **WHEN** an authenticated user requests runtime operations for a thread they own
- **THEN** the system allows access and returns only records owned by that user

#### Scenario: Cross-user thread access attempt
- **WHEN** an authenticated user requests runtime operations for a thread owned by a different user
- **THEN** the system rejects the request and does not expose thread metadata, messages, sandbox state, or events

### Requirement: Remove anonymous client ownership contract from runtime APIs
The system MUST NOT use caller-provided anonymous client ownership identifiers as an authorization boundary for chat runtime APIs.

#### Scenario: Runtime request includes legacy client ownership field
- **WHEN** a request includes legacy client ownership parameters
- **THEN** the system ignores or rejects those fields for authorization decisions and uses authenticated user context only

#### Scenario: Runtime request without authenticated context
- **WHEN** a runtime API request is made without a valid authenticated user
- **THEN** the system rejects the request as unauthorized

### Requirement: Prevent caller-forged user ownership in runtime mutation paths
The runtime mutation path (including RPC-backed message submission) MUST enforce authenticated ownership from server-derived auth context and MUST NOT trust caller-provided `user_id`.

#### Scenario: Caller submits mismatched user ownership
- **WHEN** a caller attempts to submit a runtime mutation with a user identifier that does not match the authenticated token identity
- **THEN** the runtime rejects the request and does not persist cross-user records

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

### Requirement: Use creator-centered runtime status language
The chat thread workspace SHALL translate runtime and sandbox lifecycle states into concise user-facing creation language.

#### Scenario: Experience generation is in progress
- **WHEN** a run, tool invocation, or sandbox build is actively processing
- **THEN** the interface shows a creator-centered in-progress status label rather than internal runtime terminology

#### Scenario: Experience generation fails
- **WHEN** run or sandbox processing reaches a failure state
- **THEN** the interface shows a clear failure state with recovery guidance and preserved retry affordance

#### Scenario: Live event stream is reconnecting
- **WHEN** event updates are temporarily disconnected
- **THEN** the interface communicates reconnecting status in user-facing language without exposing transport-level details

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

