## MODIFIED Requirements

### Requirement: Refine experience using prior artifact and user intent
The system SHALL accept refinement requests that include prior generated artifact context and user refinement instruction, return a full replacement payload with `title`, `description`, `html`, `css`, and `js`, and persist the refined result as a new linked version.

#### Scenario: Refinement request produces updated artifact
- **WHEN** a user submits a refinement instruction with a valid previous experience payload
- **THEN** the system returns a complete regenerated payload incorporating the refinement intent

#### Scenario: Missing previous artifact is rejected
- **WHEN** a user submits a refinement instruction without required previous payload fields
- **THEN** the system returns a validation error and does not invoke model generation

#### Scenario: Successful refinement persists linked version
- **WHEN** a refinement request succeeds
- **THEN** the system stores a new version linked to the parent experience lineage in persistence storage
