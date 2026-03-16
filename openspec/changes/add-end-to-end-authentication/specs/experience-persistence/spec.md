## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Support anonymous client scoping for persistence
**Reason**: Anonymous client-scoping is not a reliable security boundary and does not satisfy authenticated ownership requirements.
**Migration**: Replace `client_id` ownership checks and contracts with authenticated `user_id` ownership and RLS-enforced access policies.

## ADDED Requirements

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
