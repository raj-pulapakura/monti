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

