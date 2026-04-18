## ADDED Requirements

### Requirement: Expose cancel endpoint for in-flight runs
The system SHALL expose `POST /api/chat/threads/:threadId/runs/:runId/cancel` that aborts an active run and transitions it to `cancelled`. The endpoint MUST be idempotent: if the run is already in a terminal state (`succeeded`, `failed`, `cancelled`) the system SHALL return `200 OK` without mutating state.

#### Scenario: Cancel an active run
- **WHEN** an authenticated thread owner calls `POST .../runs/:runId/cancel` while the run status is `queued` or `running`
- **THEN** the system aborts the in-flight LLM fetch, marks the run `cancelled`, persists any partial assistant text streamed before abort, rolls back sandbox state if generation was mid-execution, emits `run_cancelled` SSE event, and returns `{ ok: true }`

#### Scenario: Cancel already-completed run
- **WHEN** an authenticated thread owner calls cancel on a run whose status is `succeeded`, `failed`, or `cancelled`
- **THEN** the system returns `{ ok: true }` without mutating the run or emitting events

#### Scenario: Cancel run belonging to different thread
- **WHEN** the run id does not belong to the specified thread
- **THEN** the system returns a validation error and does not abort anything

#### Scenario: Cancel run belonging to different user
- **WHEN** an authenticated user calls cancel on a run in a thread they do not own
- **THEN** the system rejects the request as unauthorized

### Requirement: Maintain in-memory abort registry per run
The system SHALL maintain an in-memory `AbortController` registry keyed by run id. An entry MUST be registered before the conversation loop starts and MUST be released on any terminal outcome (succeeded, failed, cancelled). On cancel request, the registry entry is signalled; if no entry exists (e.g., after a server restart), the run is directly DB-marked `cancelled`.

#### Scenario: Registry entry exists at cancel time
- **WHEN** the cancel endpoint is called and the run has a registered AbortController
- **THEN** the controller is aborted, propagating the signal into the in-flight LLM fetch and tool execution

#### Scenario: Registry entry absent at cancel time (post-restart zombie run)
- **WHEN** the cancel endpoint is called and no AbortController is registered for that run id
- **THEN** the system marks the run `cancelled` in the DB and emits `run_cancelled` SSE event without attempting LLM abort

#### Scenario: Registry entry released on run completion
- **WHEN** a run reaches any terminal status (succeeded, failed, cancelled)
- **THEN** the registry entry for that run id is removed

### Requirement: Persist partial assistant text on cancel
The system SHALL persist the assistant text streamed up to the abort point as the final assistant message when a run is cancelled mid-LLM-stream. If no text was streamed before cancellation, no assistant message is persisted.

#### Scenario: Cancel during LLM text streaming
- **WHEN** a run is cancelled while the LLM is streaming assistant text
- **THEN** the system persists the text accumulated up to the abort as the assistant message, emits `assistant_message_created`, then emits `run_cancelled`

#### Scenario: Cancel before any text is streamed
- **WHEN** a run is cancelled before the LLM emits any assistant text
- **THEN** no assistant message is persisted and the system emits `run_cancelled` directly

### Requirement: Roll back sandbox state on cancelled generation
If a `generate_experience` tool call is in-flight when a run is cancelled, the system SHALL roll the sandbox state back to the most recent stable state (previous `ready` experience, or `empty` if none exists). The system SHALL NOT set sandbox status to `error` on cancellation.

#### Scenario: Cancel during generate_experience execution
- **WHEN** a run is cancelled while `sandbox_state.status` is `creating`
- **THEN** the sandbox state is restored to the prior stable state (previous ready experience or empty) and a `sandbox_updated` SSE event reflects the rolled-back state

#### Scenario: Cancel before tool execution begins
- **WHEN** a run is cancelled before any `generate_experience` tool call starts (e.g., during LLM text phase)
- **THEN** the sandbox state is not modified

### Requirement: Record credit usage for partial run on cancel
The system SHALL record the token usage accumulated across completed conversation rounds before the abort point on the run telemetry record. Rounds whose streaming was interrupted SHALL contribute zero usage (since the round did not complete).

#### Scenario: Cancel after one completed round
- **WHEN** a run is cancelled during a second LLM round after one completed round
- **THEN** the run telemetry records the token usage from the completed round only

#### Scenario: Cancel during first round
- **WHEN** a run is cancelled during the first LLM round before it completes
- **THEN** the run telemetry records zero conversation usage

### Requirement: Stop button replaces send button during generation
The chat composer SHALL display a stop (square) icon button in place of the send button whenever a run is in-flight (status `queued` or `running`). Clicking the stop button SHALL call the cancel endpoint for the active run. The stop button SHALL show a pending state (spinner) while the cancel HTTP request is in flight to prevent double-submission.

#### Scenario: Run becomes active
- **WHEN** `activeRun.status` transitions to `queued` or `running`
- **THEN** the composer send button is replaced by a stop button with a square icon

#### Scenario: User clicks stop button
- **WHEN** the user clicks the stop button
- **THEN** the button enters pending state, the cancel endpoint is called, and the button remains in pending state until the response arrives or the run transitions to a terminal state

#### Scenario: Run terminates
- **WHEN** the active run reaches a terminal state (`succeeded`, `failed`, `cancelled`)
- **THEN** the stop button is replaced by the normal send button
