# native-provider-tool-calling Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Support native tool-calling across configured providers
The system SHALL execute the main conversation loop through a configured constant provider/model using each provider's native tool-calling and streaming semantics, while allowing tool executors to use routed provider/model selections for downstream generation.

#### Scenario: Constant conversation provider executes native streamed tool call
- **WHEN** the configured conversation model requests `generate_experience`
- **THEN** the runtime handles the request using that provider's native streaming and tool-calling format while preserving the canonical orchestration contract

#### Scenario: Generation executor uses routed provider
- **WHEN** `generate_experience` starts execution
- **THEN** the generation engine independently resolves provider/model via routing policy without changing the configured conversation model

### Requirement: Maintain canonical internal orchestration contract
The orchestration layer MUST consume and emit canonical assistant/tool objects that separate conversation-loop state from generation-engine tool state, including streamed assistant draft updates before terminal turn completion.

#### Scenario: Conversation draft normalization
- **WHEN** a provider emits incremental assistant text before the turn completes
- **THEN** orchestration normalizes that output into canonical assistant draft callbacks without exposing provider-native chunk shapes outside the adapter boundary

#### Scenario: Conversation tool request normalization
- **WHEN** the conversation model emits a tool request
- **THEN** orchestration normalizes tool name, arguments, and correlation identifiers into canonical runtime records

#### Scenario: Tool result handoff normalization
- **WHEN** a tool executor returns result payloads
- **THEN** orchestration maps those payloads into canonical tool-result objects for model follow-up inference and persistence

### Requirement: Persist tool invocation lifecycle
The system SHALL persist each tool invocation with correlation to thread, conversation run, and generation execution identifiers, including status transitions and normalized errors.

#### Scenario: Tool invocation succeeds
- **WHEN** `generate_experience` completes successfully
- **THEN** the system persists invocation status `succeeded` with structured output reference and correlation ids

#### Scenario: Tool invocation fails
- **WHEN** generation execution fails within the tool path
- **THEN** the system persists invocation status `failed` with normalized error details and correlation ids

### Requirement: Continue tool loop until terminal assistant output
The system MUST support repeated native tool-call rounds in the conversation loop and only terminate when the conversation model emits terminal assistant output without additional tool calls. Incremental assistant draft text MAY be emitted before tool calls or final completion, but terminal persistence MUST wait until the turn is complete.

#### Scenario: Multi-step tool loop with streamed pre-tool assistant output
- **WHEN** the conversation model emits assistant draft text and then more than one tool call before final reply
- **THEN** orchestration streams the assistant draft, executes each tool call, and re-enters the same conversation model loop with accumulated tool results

#### Scenario: Terminal assistant turn
- **WHEN** the next conversation model turn contains no tool calls
- **THEN** orchestration persists final assistant output and finalizes the conversation run

### Requirement: Normalize provider-native failures
The system MUST map provider-native tool-calling failures into a consistent runtime error taxonomy for API and event consumers.

#### Scenario: Provider-native timeout
- **WHEN** provider execution exceeds configured timeout during tool loop
- **THEN** the run fails with normalized timeout code and retry-safe metadata

#### Scenario: Provider-native refusal
- **WHEN** provider refuses a turn before tool completion
- **THEN** the run fails with normalized refusal code and no partial assistant success state

### Requirement: Emit normalized usage telemetry for completed provider-native turns
The canonical tool-turn response MUST include normalized usage telemetry for the completed provider-native conversation turn. When provider usage is observed, the canonical response MUST expose the normalized counts; when provider usage is unavailable, the canonical response MUST represent that state explicitly instead of omitting telemetry silently.

#### Scenario: Completed provider-native turn includes observed usage
- **WHEN** a provider-native conversation turn completes and the provider response exposes token usage
- **THEN** the canonical tool-turn response includes normalized observed usage telemetry for that turn

#### Scenario: Completed provider-native turn lacks usage metadata
- **WHEN** a provider-native conversation turn completes without exposing token usage
- **THEN** the canonical tool-turn response includes usage telemetry marked unavailable with no fabricated token counts

### Requirement: generate_experience tool schema omits format and audience

The tool definition for `generate_experience` exposed to the conversation model SHALL NOT declare `format` or `audience` parameters. The model SHALL express any desired pacing, style, or interaction shape in natural language within the prompt.

#### Scenario: Tool registry lists no format parameter

- **WHEN** the runtime registers or serializes tool definitions for the conversation provider
- **THEN** the `generate_experience` schema does not include a `format` property

#### Scenario: Tool registry lists no audience parameter

- **WHEN** the runtime registers or serializes tool definitions for the conversation provider
- **THEN** the `generate_experience` schema does not include an `audience` property

### Requirement: Build provider-specific tool call blocks from canonical message history

Provider adapters SHALL construct the provider-native tool call and tool result message structures from canonical message history (assistant messages with `toolCalls` and tool-result messages) rather than from `providerContinuation.pendingToolCalls`.

#### Scenario: Anthropic adapter builds tool_use block from canonical history

- **WHEN** the conversation history contains an assistant message with `toolCalls`
- **THEN** the Anthropic adapter constructs an assistant message with `tool_use` content blocks from that canonical data, without relying on `providerContinuation.anthropic.pendingToolCalls`

#### Scenario: Anthropic adapter builds tool_result block from canonical history

- **WHEN** the conversation history contains a `role: 'tool'` message following an assistant tool-call message
- **THEN** the Anthropic adapter constructs a user message with `tool_result` content blocks referencing the correct `tool_use_id`

#### Scenario: Gemini adapter builds functionCall turn from canonical history

- **WHEN** the conversation history contains an assistant message with `toolCalls`
- **THEN** the Gemini adapter constructs a model turn with `functionCall` parts from that canonical data, without relying on `providerContinuation.gemini.pendingToolCalls`

#### Scenario: Gemini adapter builds functionResponse turn from canonical history

- **WHEN** the conversation history contains a `role: 'tool'` message following an assistant tool-call message
- **THEN** the Gemini adapter constructs a user turn with `functionResponse` parts referencing the correct function name

#### Scenario: Provider adapter handles conversation with no prior tool exchanges

- **WHEN** the canonical conversation history contains no assistant messages with `toolCalls` and no tool-result messages
- **THEN** the provider adapter builds the request with only user and assistant text turns, identical to current behaviour

### Requirement: OpenAI adapter multi-turn tool history approach verified against Responses API documentation

The OpenAI Responses API adapter's approach to multi-turn tool call history — whether via persisted `previous_response_id` chaining or stateless full-history reconstruction — SHALL be verified against the current OpenAI Responses API documentation before implementation and the chosen approach SHALL be consistent with the API's documented contract.

#### Scenario: Implementor verifies previous_response_id persistence behaviour

- **WHEN** implementing the OpenAI adapter update
- **THEN** the implementor confirms whether `previous_response_id` has a server-side TTL, whether it can safely be reused across separate HTTP request lifetimes, and documents the decision in code comments

