# llm-routing-decision Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Route each assistant run using lightweight router LLM
The system SHALL perform internal routing inference for each `generate_experience` tool execution to select generation tier/provider/model before generation dispatch.

#### Scenario: Router executes inside generation tool path
- **WHEN** a conversation loop invokes `generate_experience`
- **THEN** the tool executor performs routing inference before generation model dispatch

### Requirement: Enforce structured router output contract
The router output MUST conform to a validated structured schema containing `tier`, `confidence`, and `reason`.

#### Scenario: Valid router output
- **WHEN** router output matches schema
- **THEN** orchestration accepts the decision and applies policy mapping to concrete provider/model

#### Scenario: Invalid router output
- **WHEN** router output is malformed or missing required fields
- **THEN** orchestration rejects the output and falls back to configured default routing policy

### Requirement: Remove user-facing quality mode controls from execution contract
The runtime SHALL determine generation tier internally and MUST NOT require client-provided fast/quality selection for conversation or generation execution.

#### Scenario: Client omits quality field
- **WHEN** frontend submits a chat message without quality hints
- **THEN** the backend executes conversation loop and generation routing successfully without validation error for missing quality mode

### Requirement: Persist routing decision telemetry
The system SHALL persist routing inputs/outputs needed for auditability, including selected tier/provider/model and fallback indicators.

#### Scenario: Router selected route persisted
- **WHEN** router output is accepted during tool execution
- **THEN** run telemetry records selected tier/provider/model and confidence metadata

#### Scenario: Fallback route persisted
- **WHEN** router invocation fails and default policy is applied
- **THEN** run telemetry records fallback reason and resulting provider/model selection

