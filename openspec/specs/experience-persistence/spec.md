# experience-persistence Specification

## Purpose
TBD - created by archiving change add-supabase-persistence. Update Purpose after archive.
## Requirements
### Requirement: Persist experiences and versioned artifacts in Supabase
The system SHALL persist generated learning experiences in a normalized data model with a top-level experience record and versioned artifact records produced by tool invocations in assistant runs.

#### Scenario: Successful generation creates persisted experience and version
- **WHEN** a generation tool invocation completes successfully after payload validation and safety checks
- **THEN** the system creates or reuses an experience record and inserts a new version record containing generated artifact fields and metadata

#### Scenario: Version numbering is unique per experience
- **WHEN** a new version is inserted for an existing experience
- **THEN** the version is stored with a unique incrementing `version_number` scoped to that experience

### Requirement: Persist generation/refinement run telemetry
The system SHALL persist run telemetry for successful and failed execution across conversation runs, routing decisions, generation runs, and tool invocations.

#### Scenario: Successful execution telemetry is recorded
- **WHEN** conversation orchestration and generation execution succeed
- **THEN** the system stores conversation run status, routing metadata, generation provider/model selection, timing, and linkage across thread/message/tool/artifact records

#### Scenario: Failed execution telemetry is recorded
- **WHEN** conversation orchestration, routing, or generation tool execution fails after run creation
- **THEN** the system stores failed status and normalized error context with correlation to the affected conversation run and tool invocation

### Requirement: Support anonymous client scoping for persistence
The system SHALL support persistence without auth by associating thread and artifact records with a required client-scoping identifier.

#### Scenario: Anonymous client creates first persisted thread and experience
- **WHEN** a request includes a client-scoping identifier and no matching thread context exists
- **THEN** the system creates thread-scoped records and allows subsequent artifact persistence under that client scope

#### Scenario: Missing client-scoping identifier is rejected
- **WHEN** a persistence write is attempted without a required client-scoping identifier
- **THEN** the system returns a validation error and does not write persistence records

