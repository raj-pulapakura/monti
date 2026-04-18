## MODIFIED Requirements

### Requirement: Run a fixed-model conversational loop per user turn
The system SHALL execute each accepted user turn through a configured constant conversation model and continue that model loop until a terminal assistant response is produced or an abort signal fires. The abort signal SHALL be checked before each LLM round and before each tool call execution; on signal receipt the loop SHALL exit cleanly without producing a failed error.

#### Scenario: Conversation loop starts on user message
- **WHEN** a user message is persisted for a thread
- **THEN** the system starts a conversation run using the configured conversation model and records run lifecycle state

#### Scenario: Loop terminates with assistant reply
- **WHEN** the conversation model emits a final assistant message with no pending tool calls
- **THEN** the system persists that assistant message and marks the conversation run as succeeded

#### Scenario: Loop aborted between rounds
- **WHEN** an abort signal fires between two LLM rounds
- **THEN** the loop exits without calling the next LLM round, persists any partial assistant text from the previous round, and marks the run `cancelled`

#### Scenario: Loop aborted during LLM streaming
- **WHEN** an abort signal fires while the LLM is streaming a response
- **THEN** the in-flight fetch is aborted, accumulated streamed text is persisted as the assistant message, and the run is marked `cancelled`

#### Scenario: Loop aborted during tool execution
- **WHEN** an abort signal fires while a tool call is executing
- **THEN** the tool execution fetch is aborted, the tool invocation is marked failed with code `USER_CANCELLED`, sandbox state is rolled back to the prior stable state, and the run is marked `cancelled`

### Requirement: Keep looping until no more tool invocations
The runtime MUST continue the conversation model tool loop through repeated assistant/tool turns until the model emits a terminal message with no further tool calls. When a tool call requires confirmation, the loop SHALL pause (status `awaiting_confirmation`) rather than exit with an error. The loop resumes from the paused position when the user confirms or cancels. Loop continuation after a cancelled tool call SHALL proceed normally — the LLM receives the cancellation result and generates a response. When an abort signal fires at any point in the loop, the loop SHALL exit immediately and transition the run to `cancelled`.

#### Scenario: Multiple tool calls in one conversation run
- **WHEN** the conversation model emits sequential tool calls before final response
- **THEN** the runtime executes each tool call in order and resumes model inference after each tool result

#### Scenario: Terminal response after tool sequence
- **WHEN** the final model turn includes no tool calls
- **THEN** the runtime finalizes the conversation run and emits terminal run event(s)

#### Scenario: Tool call requires confirmation — loop pauses
- **WHEN** the conversation model emits a tool call where `requiresConfirmation` returns `true`
- **THEN** the runtime writes the assistant tool-call message, marks the run `awaiting_confirmation`, emits `confirmation_required`, and exits the loop without executing the tool

#### Scenario: User confirms — loop resumes and continues
- **WHEN** the user confirms a paused run
- **THEN** the loop re-enters from the paused position, executes the confirmed tool with the user-selected quality mode, writes the tool result, and continues iterating remaining tool calls in the same set

#### Scenario: User cancels — loop resumes with cancelled result
- **WHEN** the user cancels a paused run
- **THEN** the loop re-enters, writes a tool result `{ status: 'cancelled', operation }`, routes that result back to the LLM, and the LLM generates an acknowledgement response; the run completes normally

#### Scenario: Next tool call after confirmed one also requires confirmation
- **WHEN** after a confirmed tool executes, the next tool call in the same set also has `requiresConfirmation: true`
- **THEN** the loop pauses again with an updated `confirmation_tool_call_id`, emits a new `confirmation_required` event, and waits for the next user decision

#### Scenario: Abort signal fires before a pending tool call executes
- **WHEN** an abort signal is set before the loop begins executing a tool call in the current set
- **THEN** the loop does not execute the tool, cleans up sandbox state if needed, and exits with `cancelled` status
