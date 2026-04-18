# tool-confirmation-gate Specification

## Purpose

Define how tools declare confirmation requirements, how the conversation run pauses and resumes, how clients confirm or cancel via HTTP, and how sequential confirmations work when multiple gated tools appear in one model response.

## Requirements

### Requirement: Tools declare whether they require user confirmation

Each registered tool SHALL expose a `requiresConfirmation(args)` method that returns a boolean. The conversation loop SHALL call this method before executing any tool call. The `generate_experience` tool SHALL always return `true` regardless of arguments (both `generate` and `refine` operations). Future tools MAY return `false` to bypass the gate entirely.

#### Scenario: generate_experience always requires confirmation

- **WHEN** the LLM requests `generate_experience` with any arguments
- **THEN** `requiresConfirmation` returns `true` and the gate flow is initiated

#### Scenario: A hypothetical tool that does not require confirmation

- **WHEN** the LLM requests a tool whose `requiresConfirmation` returns `false`
- **THEN** the tool executes immediately with no gate, no SSE event, and no run status change

### Requirement: Conversation run pauses in `awaiting_confirmation` when a tool requires confirmation

When the loop encounters a tool call where `requiresConfirmation` returns `true`, the system SHALL:

1. Mark the `assistant_runs` row status as `awaiting_confirmation`
2. Store `confirmation_tool_call_id` (the tool call ID being gated) and `confirmation_metadata` (operation label, estimated credits for both modes) on the run row
3. Emit a `confirmation_required` SSE event on the thread stream
4. Exit the loop without executing the tool

The HTTP request that triggered the run MAY have already terminated; the pause is durable via the DB row.

#### Scenario: Run pauses on first confirmable tool call

- **WHEN** the LLM returns a tool call where `requiresConfirmation` is `true`
- **THEN** the run status becomes `awaiting_confirmation`, `confirmation_tool_call_id` is set to that tool call's ID, a `confirmation_required` SSE event is emitted, and the tool is not executed

#### Scenario: confirmation_required SSE event payload

- **WHEN** a `confirmation_required` event is emitted
- **THEN** the payload includes: `runId`, `toolCallId`, `operation` (generate|refine), `estimatedCredits: { fast: number, quality: number }`

#### Scenario: Non-confirmable tool calls before a confirmable one execute immediately

- **WHEN** the LLM returns [tool_A (no confirmation), tool_B (requires confirmation)]
- **THEN** tool_A executes immediately, then tool_B triggers the gate; the run pauses with `confirmation_tool_call_id` pointing to tool_B

### Requirement: User confirms or cancels via a dedicated endpoint

The system SHALL expose `POST /api/chat/threads/:threadId/runs/:runId/confirm` accepting `{ decision: 'confirmed' | 'cancelled', qualityMode?: 'fast' | 'quality' }`. The endpoint SHALL validate that the run belongs to the authenticated user and has status `awaiting_confirmation`. On success, it SHALL resume the conversation loop asynchronously (fire-and-forget) and return immediately.

#### Scenario: Confirmed with a valid quality mode

- **WHEN** the user POSTs `{ decision: 'confirmed', qualityMode: 'quality' }` to a run in `awaiting_confirmation`
- **THEN** the endpoint returns `200 ok`, and the run resumes asynchronously: the confirmed tool executes with `qualityMode: 'quality'`, the tool result is written, and the loop continues

#### Scenario: Cancelled

- **WHEN** the user POSTs `{ decision: 'cancelled' }` to a run in `awaiting_confirmation`
- **THEN** the endpoint returns `200 ok`, and the run resumes asynchronously: a tool result message `{ status: 'cancelled', operation }` is written to `chat_messages`, the LLM generates an acknowledgement response, and the run completes normally

#### Scenario: Confirm called on a run not in awaiting_confirmation

- **WHEN** the user POSTs to a run with status other than `awaiting_confirmation`
- **THEN** the endpoint returns an error and no action is taken

#### Scenario: Confirm called on a run belonging to another user

- **WHEN** the request's authenticated user does not own the run's thread
- **THEN** the endpoint returns a 404 or 403 error and no action is taken

### Requirement: Sequential confirmation for multiple tool calls in one LLM response

When a paused run is confirmed and the confirmed tool executes successfully, the loop SHALL continue iterating any remaining tool calls from the same LLM response. If the next tool call also requires confirmation, the run SHALL pause again with an updated `confirmation_tool_call_id`. This repeats until all tool calls in the set are resolved, then the next LLM round begins.

#### Scenario: Two consecutive confirmable tool calls

- **WHEN** the LLM returns [tool_A (confirmation), tool_B (confirmation)] and the user confirms tool_A
- **THEN** tool_A executes, a tool result is written, then the run pauses again on tool_B with a new `confirmation_required` event; after the user confirms tool_B, it executes and the loop proceeds to the next LLM round

#### Scenario: Confirmed tool followed by non-confirmable tool

- **WHEN** the LLM returns [tool_A (confirmation), tool_B (no confirmation)] and the user confirms tool_A
- **THEN** tool_A executes, then tool_B executes immediately without gating, then the loop proceeds to the next LLM round

### Requirement: Confirmation gate state is recoverable from thread hydration

The `GET /api/chat/threads/:threadId` response SHALL include an `activeRun` object when the run status is `awaiting_confirmation`. The `activeRun` SHALL include `status`, `confirmationToolCallId`, and `confirmationMetadata` (operation, estimatedCredits). This allows the UI to reconstruct the gate without relying on the in-memory SSE replay.

#### Scenario: User reopens the app with a pending confirmation

- **WHEN** a user navigates to a thread where the active run has status `awaiting_confirmation`
- **THEN** the thread hydration response includes the active run with confirmation metadata and the UI renders the gate immediately

#### Scenario: Server restart with pending confirmation

- **WHEN** the server restarts while a run is in `awaiting_confirmation`
- **THEN** the next hydration request returns the run in `awaiting_confirmation` and the UI renders the gate, because state is persisted in the DB
