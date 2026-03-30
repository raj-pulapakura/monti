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
The runtime MUST continue the conversation model tool loop through repeated assistant/tool turns until the model emits a terminal message with no further tool calls.

#### Scenario: Multiple tool calls in one conversation run
- **WHEN** the conversation model emits sequential tool calls before final response
- **THEN** the runtime executes each tool call in order and resumes model inference after each tool result

#### Scenario: Terminal response after tool sequence
- **WHEN** the final model turn includes no tool calls
- **THEN** the runtime finalizes the conversation run and emits terminal run event(s)

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

