# conversation-tool-loop Specification

## Purpose
TBD - created by archiving change decouple-conversation-and-generation. Update Purpose after archive.
## Requirements
### Requirement: Run a fixed-model conversational loop per user turn
The system SHALL execute each accepted user turn through a configured constant conversation model and continue that model loop until a terminal assistant response is produced.

#### Scenario: Conversation loop starts on user message
- **WHEN** a user message is persisted for a thread
- **THEN** the system starts a conversation run using the configured conversation model and records run lifecycle state

#### Scenario: Loop terminates with assistant reply
- **WHEN** the conversation model emits a final assistant message with no pending tool calls
- **THEN** the system persists that assistant message and marks the conversation run as succeeded

### Requirement: Support tool-optional chat behavior
The conversation loop MUST remain functional when no tools are registered, behaving as a standard chat assistant without generation-specific failures.

#### Scenario: No tools configured
- **WHEN** the conversation model is invoked with an empty tool set
- **THEN** the system still accepts user messages and returns model-authored assistant replies

#### Scenario: Tool removed from configuration
- **WHEN** `generate_experience` is unavailable in the tool registry
- **THEN** the conversation loop completes without attempting generation and without emitting generation tool lifecycle errors

### Requirement: Delegate generation to tool executor boundary
The conversation loop SHALL invoke generation only via `generate_experience` tool calls and SHALL treat generation as an external engine boundary.

#### Scenario: Conversation model calls generate_experience
- **WHEN** the conversation model requests `generate_experience`
- **THEN** the runtime dispatches the tool executor path and waits for structured tool result payload

#### Scenario: Conversation model does not call tools
- **WHEN** the conversation model decides no tool is needed
- **THEN** the runtime does not invoke generation engine components for that turn

### Requirement: Use model-authored post-tool responses
The system MUST route tool results back to the conversation model so follow-up assistant messages are model-authored rather than hardcoded runtime strings.

#### Scenario: Successful generation tool result
- **WHEN** `generate_experience` returns a success result
- **THEN** the conversation model receives that result and generates the user-facing assistant message

#### Scenario: Failed generation tool result
- **WHEN** `generate_experience` returns a failure result
- **THEN** the conversation model receives normalized failure metadata and generates the user-facing assistant message

### Requirement: Keep looping until no more tool invocations
The runtime MUST continue the conversation model tool loop through repeated assistant/tool turns until the model emits a terminal message with no further tool calls. When a tool call requires confirmation, the loop SHALL pause (status `awaiting_confirmation`) rather than exit with an error. The loop resumes from the paused position when the user confirms or cancels. Loop continuation after a cancelled tool call SHALL proceed normally — the LLM receives the cancellation result and generates a response.

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

### Requirement: Persist aggregated conversation-model usage across completed loop rounds
The system SHALL aggregate observed conversation-model token usage across completed rounds in an assistant run and persist the aggregate on the assistant-run telemetry record only when every completed round in that run exposed observed usage.

#### Scenario: Single-round assistant run persists conversation usage
- **WHEN** an assistant run completes after one conversation-model round and that round exposes observed usage
- **THEN** the assistant-run telemetry stores the observed conversation-model token totals for that run

#### Scenario: Multi-round tool loop persists aggregated conversation usage
- **WHEN** an assistant run completes after multiple conversation-model rounds and every completed round exposes observed usage
- **THEN** the assistant-run telemetry stores the aggregate conversation-model token totals across those rounds

#### Scenario: Missing round usage leaves run totals unavailable
- **WHEN** any completed conversation-model round in an assistant run lacks observed usage
- **THEN** the assistant-run telemetry leaves aggregate conversation-model token totals unavailable rather than storing a partial total

### Requirement: Build complete conversation history including tool exchanges for each LLM turn

The system SHALL include assistant tool-call messages and tool-result messages from `chat_messages` in the conversation history passed to the LLM on every turn, producing a complete and technically correct message sequence per provider API requirements.

#### Scenario: Follow-up user message includes prior tool exchange in history

- **WHEN** a user sends a follow-up message after a previous turn that included a tool call
- **THEN** the conversation history sent to the LLM includes the assistant tool-call message and the tool-result message from the prior turn, in order, between the surrounding user and assistant text messages

#### Scenario: First user message has no prior tool exchange

- **WHEN** a user sends the first message in a thread
- **THEN** the conversation history contains only the system prompt and the user message, with no tool messages

#### Scenario: Tool messages are not omitted from context window

- **WHEN** the conversation history is windowed to the configured context size
- **THEN** tool-role messages and assistant messages with tool calls are included in the window alongside user and assistant text messages

### Requirement: Context window never starts mid-tool-exchange

The system SHALL ensure the context window boundary always falls at a user message boundary, never between an assistant tool-call message and its corresponding tool-result message.

#### Scenario: Window boundary falls inside a tool exchange

- **WHEN** the configured context window size would cause the window to start at an assistant tool-call message or a tool-result message
- **THEN** the window start is snapped backward to the nearest preceding user message so the full exchange is either included or excluded as a unit

#### Scenario: Window boundary falls at a clean user message

- **WHEN** the configured context window size naturally aligns with a user message boundary
- **THEN** no adjustment is made and the window starts at that user message

