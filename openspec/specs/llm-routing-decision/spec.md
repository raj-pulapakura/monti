# llm-routing-decision Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Route each assistant run using lightweight router LLM
The system SHALL perform an internal routing model call before main run execution to select execution tier/provider for that run.

#### Scenario: Router executes before main assistant model
- **WHEN** a new assistant run begins
- **THEN** the system performs router inference and records the routing decision before dispatching the main model call

### Requirement: Enforce structured router output contract
The router output MUST conform to a validated structured schema containing at least `tier`, `confidence`, and `reason`, with optional provider preference fields.

#### Scenario: Valid router output
- **WHEN** router output matches schema
- **THEN** orchestration accepts the decision and applies policy mapping to concrete provider/model

#### Scenario: Invalid router output
- **WHEN** router output is malformed or missing required fields
- **THEN** orchestration rejects the output and falls back to configured default routing policy

### Requirement: Remove user-facing quality mode controls from execution contract
The runtime SHALL determine tier/provider internally and MUST NOT require client-provided fast/quality selection for message execution.

#### Scenario: Client omits quality field
- **WHEN** frontend submits a new chat message without quality hints
- **THEN** the backend executes routing and run dispatch successfully without validation error for missing quality mode

### Requirement: Persist routing decision telemetry
The system SHALL persist routing inputs/outputs needed for auditability, including selected provider/model and fallback indicators.

#### Scenario: Router selected route persisted
- **WHEN** router output is accepted
- **THEN** run telemetry records selected tier/provider/model and confidence metadata

#### Scenario: Fallback route persisted
- **WHEN** router invocation fails and default policy is applied
- **THEN** run telemetry records fallback reason and resulting provider/model selection

