## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: OpenAI adapter multi-turn tool history approach verified against Responses API documentation
The OpenAI Responses API adapter's approach to multi-turn tool call history — whether via persisted `previous_response_id` chaining or stateless full-history reconstruction — SHALL be verified against the current OpenAI Responses API documentation before implementation and the chosen approach SHALL be consistent with the API's documented contract.

#### Scenario: Implementor verifies previous_response_id persistence behaviour
- **WHEN** implementing the OpenAI adapter update
- **THEN** the implementor confirms whether `previous_response_id` has a server-side TTL, whether it can safely be reused across separate HTTP request lifetimes, and documents the decision in code comments
