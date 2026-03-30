# experience-persistence Specification

## ADDED Requirements

### Requirement: Persist request-level generation usage totals and retry count
The system SHALL persist request-level usage telemetry for generate and refine execution on `generation_runs`. Each request record MUST include `attempt_count`, and it MUST persist request-level token totals only when usage was observed for every generation attempt in that request.

#### Scenario: Single-attempt success persists request totals
- **WHEN** a generate or refine request succeeds on the first attempt and that attempt exposes observed usage
- **THEN** the corresponding `generation_runs` record stores `attempt_count = 1` and the observed request-level token totals

#### Scenario: Retry success persists rolled-up request totals
- **WHEN** a generate or refine request succeeds after one automatic retry and both attempts expose observed usage
- **THEN** the corresponding `generation_runs` record stores the rolled-up request-level token totals across both attempts and `attempt_count = 2`

#### Scenario: Incomplete attempt usage leaves request totals unavailable
- **WHEN** any generation attempt in a request lacks observed usage
- **THEN** the corresponding `generation_runs` record still stores `attempt_count` but leaves request-level token totals unavailable rather than persisting a partial total

### Requirement: Persist successful artifact-producing token usage on experience versions
The system SHALL persist observed token usage for the successful artifact-producing generation attempt on `experience_versions` using the artifact token fields already defined by the schema.

#### Scenario: Successful generation with observed usage writes artifact token counts
- **WHEN** a generate or refine request succeeds and the successful artifact-producing attempt exposes observed usage
- **THEN** the persisted `experience_versions` row stores the observed input and output token counts for that successful attempt

#### Scenario: Successful generation without observed usage leaves artifact token counts unavailable
- **WHEN** a generate or refine request succeeds but the successful artifact-producing attempt does not expose observed usage
- **THEN** the persisted `experience_versions` row leaves artifact token counts unavailable and does not substitute estimated values

### Requirement: Persist failed request telemetry without inventing usage
The system MUST preserve generation request lifecycle telemetry for failed requests while applying the same observed-only rule to usage fields.

#### Scenario: Failed request with fully observed usage retains request totals
- **WHEN** a generate or refine request fails after one or more attempts and every attempt exposed observed usage
- **THEN** the failed `generation_runs` record stores the observed request-level token totals alongside the failed status

#### Scenario: Failed request with missing attempt usage records no observed totals
- **WHEN** a generate or refine request fails and any contributing attempt lacks observed usage
- **THEN** the failed `generation_runs` record stores no fabricated request-level token totals
