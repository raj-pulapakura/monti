## MODIFIED Requirements

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

### Requirement: Continue tool loop until terminal assistant output
The system MUST support repeated native tool-call rounds in the conversation loop and only terminate when the conversation model emits terminal assistant output without additional tool calls. Incremental assistant draft text MAY be emitted before tool calls or final completion, but terminal persistence MUST wait until the turn is complete.

#### Scenario: Multi-step tool loop with streamed pre-tool assistant output
- **WHEN** the conversation model emits assistant draft text and then more than one tool call before final reply
- **THEN** orchestration streams the assistant draft, executes each tool call, and re-enters the same conversation model loop with accumulated tool results

#### Scenario: Terminal assistant turn
- **WHEN** the next conversation model turn contains no tool calls
- **THEN** orchestration persists final assistant output and finalizes the conversation run
