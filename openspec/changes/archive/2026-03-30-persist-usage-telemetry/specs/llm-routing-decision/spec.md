# llm-routing-decision Specification

## ADDED Requirements

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
