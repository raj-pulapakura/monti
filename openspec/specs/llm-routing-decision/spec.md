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

### Requirement: Persist router execution telemetry per generate_experience execution
The system SHALL persist router execution telemetry for each `generate_experience` execution that invokes the router. Router telemetry MUST include the router provider and model used, the router request/response traces, the routing decision outcome, and normalized router token usage when observed.

#### Scenario: Auto-routed generate_experience execution persists router telemetry
- **WHEN** a `generate_experience` execution invokes the router model and receives a decision response
- **THEN** the system persists router provider/model, router request/response telemetry, the selected route decision, and observed router token usage for that execution

#### Scenario: Router fallback preserves failure context without invented usage
- **WHEN** router invocation fails and the runtime falls back to the default routing policy
- **THEN** the system persists the fallback reason and any observed router trace context without fabricating router token usage

#### Scenario: User-forced quality mode bypasses router telemetry
- **WHEN** a `generate_experience` execution uses a user-forced `fast` or `quality` mode and does not invoke the router model
- **THEN** the system records the forced route decision without persisting router-model usage for that execution

