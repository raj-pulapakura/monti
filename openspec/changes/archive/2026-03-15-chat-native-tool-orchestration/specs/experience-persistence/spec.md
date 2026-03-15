## MODIFIED Requirements

### Requirement: Persist experiences and versioned artifacts in Supabase
The system SHALL persist generated learning experiences in a normalized data model with a top-level experience record and versioned artifact records produced by tool invocations in assistant runs.

#### Scenario: Successful generation creates persisted experience and version
- **WHEN** a generation tool invocation completes successfully after payload validation and safety checks
- **THEN** the system creates or reuses an experience record and inserts a new version record containing generated artifact fields and metadata

#### Scenario: Version numbering is unique per experience
- **WHEN** a new version is inserted for an existing experience
- **THEN** the version is stored with a unique incrementing `version_number` scoped to that experience

### Requirement: Persist generation/refinement run telemetry
The system SHALL persist run telemetry for successful and failed execution across assistant runs, routing decisions, and tool invocations.

#### Scenario: Successful run telemetry is recorded
- **WHEN** assistant orchestration and tool execution succeed
- **THEN** the system stores routing decision metadata, provider/model selection, run statuses, timing, and linkage to associated thread/message/tool/artifact records

#### Scenario: Failed run telemetry is recorded
- **WHEN** routing, provider execution, or tool invocation fails after run creation
- **THEN** the system stores failed status and normalized error context without writing partial executable payload fields

### Requirement: Support anonymous client scoping for persistence
The system SHALL support persistence without auth by associating thread and artifact records with a required client-scoping identifier.

#### Scenario: Anonymous client creates first persisted thread and experience
- **WHEN** a request includes a client-scoping identifier and no matching thread context exists
- **THEN** the system creates thread-scoped records and allows subsequent artifact persistence under that client scope

#### Scenario: Missing client-scoping identifier is rejected
- **WHEN** a persistence write is attempted without a required client-scoping identifier
- **THEN** the system returns a validation error and does not write persistence records
