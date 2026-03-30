# experience-persistence Specification

## Purpose
TBD - created by archiving change add-supabase-persistence. Update Purpose after archive.
## Requirements
### Requirement: Persist experiences and versioned artifacts in Supabase
The system SHALL persist generated learning experiences in a normalized data model with authenticated user ownership, a top-level experience record, and versioned artifact records produced by tool invocations in assistant runs.

#### Scenario: Successful generation creates persisted experience and version
- **WHEN** a generation tool invocation completes successfully after payload validation and safety checks
- **THEN** the system creates or reuses a user-owned experience record and inserts a new version record containing generated artifact fields and metadata

#### Scenario: Version numbering is unique per experience
- **WHEN** a new version is inserted for an existing experience
- **THEN** the version is stored with a unique incrementing `version_number` scoped to that experience

### Requirement: Persist generation/refinement run telemetry
The system SHALL persist run telemetry for successful and failed execution across conversation runs, routing decisions, generation runs, and tool invocations with authenticated user ownership linkage.

#### Scenario: Successful execution telemetry is recorded
- **WHEN** conversation orchestration and generation execution succeed
- **THEN** the system stores conversation run status, routing metadata, generation provider/model selection, timing, and linkage across user-owned thread/message/tool/artifact records

#### Scenario: Failed execution telemetry is recorded
- **WHEN** conversation orchestration, routing, or generation tool execution fails after run creation
- **THEN** the system stores failed status and normalized error context with correlation to the affected conversation run and tool invocation under the authenticated user scope

### Requirement: Support authenticated user scoping for persistence
The system SHALL require authenticated user context for persistence writes and associate persisted thread/artifact records with that user identity.

#### Scenario: Authenticated user creates first persisted thread and experience
- **WHEN** a valid authenticated user performs a persistence-producing action without existing records
- **THEN** the system creates user-owned persistence records that are linked to that user identifier

#### Scenario: Missing authenticated user context is rejected
- **WHEN** a persistence write is attempted without a valid authenticated user context
- **THEN** the system returns an authentication error and does not write persistence records

### Requirement: Enforce row-level access controls for user-owned persistence data
The system MUST enforce RLS policies that allow users to access only their own persisted runtime and experience records.

#### Scenario: User reads own persistence records
- **WHEN** an authenticated user requests persistence data they own
- **THEN** the system returns the matching records successfully

#### Scenario: User requests another user's persistence records
- **WHEN** an authenticated user requests persistence data owned by a different user
- **THEN** the system denies access and does not disclose the other user's records

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

