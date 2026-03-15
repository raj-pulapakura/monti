## MODIFIED Requirements

### Requirement: Persist generation/refinement run telemetry
The system SHALL persist run telemetry for successful and failed execution across conversation runs, routing decisions, generation runs, and tool invocations.

#### Scenario: Successful execution telemetry is recorded
- **WHEN** conversation orchestration and generation execution succeed
- **THEN** the system stores conversation run status, routing metadata, generation provider/model selection, timing, and linkage across thread/message/tool/artifact records

#### Scenario: Failed execution telemetry is recorded
- **WHEN** conversation orchestration, routing, or generation tool execution fails after run creation
- **THEN** the system stores failed status and normalized error context with correlation to the affected conversation run and tool invocation
