# experience-persistence Specification

## Purpose
TBD - created by archiving change add-supabase-persistence. Update Purpose after archive.
## Requirements
### Requirement: Persist experiences and versioned artifacts in Supabase
The system SHALL persist generated learning experiences in a normalized data model with a top-level experience record and versioned artifact records.

#### Scenario: Successful generation creates persisted experience and version
- **WHEN** a generation request completes successfully after payload validation and safety checks
- **THEN** the system creates or reuses an experience record and inserts a new version record containing the generated artifact fields and metadata

#### Scenario: Version numbering is unique per experience
- **WHEN** a new version is inserted for an existing experience
- **THEN** the version is stored with a unique incrementing `version_number` scoped to that experience

### Requirement: Persist generation/refinement run telemetry
The system SHALL persist generation run metadata for each successful or failed orchestration attempt.

#### Scenario: Successful run telemetry is recorded
- **WHEN** generation or refinement succeeds
- **THEN** the system stores provider, model, status, timing, and linkage to the associated experience/version

#### Scenario: Failed run telemetry is recorded
- **WHEN** generation or refinement fails after orchestration begins
- **THEN** the system stores failed run status and error context without writing partial executable payload fields

### Requirement: Support anonymous client scoping for persistence
The system SHALL support persistence without auth by associating stored experience records with a required client-scoping identifier.

#### Scenario: Anonymous client creates first persisted experience
- **WHEN** a request includes a client-scoping identifier and no matching experience exists
- **THEN** the system creates a new experience row scoped to that client identifier

#### Scenario: Missing client-scoping identifier is rejected
- **WHEN** a persistence write is attempted without a required client-scoping identifier
- **THEN** the system returns a validation error and does not write persistence records

