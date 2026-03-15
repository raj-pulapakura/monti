# native-provider-tool-calling Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Support native tool-calling across configured providers
The system SHALL execute assistant turns using each provider's native tool-calling API semantics through provider-specific adapters.

#### Scenario: OpenAI native tool call
- **WHEN** the selected provider is OpenAI and the model requests a tool invocation
- **THEN** the adapter translates and executes the tool flow using OpenAI-native request/response structures

#### Scenario: Anthropic native tool call
- **WHEN** the selected provider is Anthropic and the model requests a tool invocation
- **THEN** the adapter translates and executes the tool flow using Anthropic-native request/response structures

#### Scenario: Gemini native tool call
- **WHEN** the selected provider is Gemini and the model requests a tool invocation
- **THEN** the adapter translates and executes the tool flow using Gemini-native request/response structures

### Requirement: Maintain canonical internal orchestration contract
The orchestration layer MUST consume and emit canonical tool-call and assistant-output objects regardless of provider-specific wire formats.

#### Scenario: Provider response normalization
- **WHEN** any provider returns tool-call output
- **THEN** the adapter normalizes it into the canonical internal tool-call representation used by orchestration and persistence

#### Scenario: Provider request translation
- **WHEN** orchestration sends canonical tool schemas and messages
- **THEN** the adapter maps them to the provider-native tool declaration format without requiring orchestration changes

### Requirement: Persist tool invocation lifecycle
The system SHALL persist each tool invocation with correlation to thread, run, and provider call identifiers, including status transitions and error context.

#### Scenario: Tool invocation succeeds
- **WHEN** a provider requests a tool and execution completes successfully
- **THEN** the system persists a tool invocation record with `succeeded` status and structured output reference/payload

#### Scenario: Tool invocation fails
- **WHEN** tool execution or provider follow-up fails
- **THEN** the system persists a tool invocation record with `failed` status and normalized error details

### Requirement: Continue tool loop until terminal assistant output
The system MUST support multi-step provider tool loops where multiple tool calls can occur before final assistant content is produced.

#### Scenario: Multiple tool calls in one run
- **WHEN** a provider requests two or more tool calls in sequence during the same run
- **THEN** orchestration executes each call, returns results to the provider, and only finalizes the run when terminal assistant content is emitted

### Requirement: Normalize provider-native failures
The system MUST map provider-native tool-calling failures into a consistent runtime error taxonomy for API and event consumers.

#### Scenario: Provider-native timeout
- **WHEN** provider execution exceeds configured timeout during tool loop
- **THEN** the run fails with normalized timeout code and retry-safe metadata

#### Scenario: Provider-native refusal
- **WHEN** provider refuses a turn before tool completion
- **THEN** the run fails with normalized refusal code and no partial assistant success state

