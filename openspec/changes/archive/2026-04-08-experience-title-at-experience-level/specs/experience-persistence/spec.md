## MODIFIED Requirements

### Requirement: Persist experiences and versioned artifacts in Supabase
The system SHALL persist generated learning experiences in a normalized data model with authenticated user ownership, a top-level experience record, and versioned artifact records produced by tool invocations in assistant runs. When creating a new experience record the system SHALL generate and persist a URL-safe slug derived from the experience title with a random hex suffix. The `experience_versions` table SHALL NOT store a `title` column; title is the exclusive property of the `experiences` record and is written once at generation time.

#### Scenario: Successful generation creates persisted experience and version
- **WHEN** a generation tool invocation completes successfully after payload validation and safety checks
- **THEN** the system creates a user-owned experience record (with title and slug) and inserts a new version record containing generated artifact fields and metadata, excluding title

#### Scenario: Version numbering is unique per experience
- **WHEN** a new version is inserted for an existing experience
- **THEN** the version is stored with a unique incrementing `version_number` scoped to that experience

#### Scenario: New experience is created with a slug
- **WHEN** a generation tool invocation creates a new top-level experience record
- **THEN** the experience record is persisted with a non-null slug of the form `{slugified-title}-{6-hex-chars}`

#### Scenario: Refinement does not write title to version
- **WHEN** a refinement tool invocation completes successfully
- **THEN** a new version record is inserted without a `title` field; the parent experience's title remains unchanged
