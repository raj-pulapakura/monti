## MODIFIED Requirements

### Requirement: Refine experience using prior artifact and user intent
The system SHALL accept refinement intent from chat context with prior artifact linkage, return a full replacement payload with `title`, `description`, `html`, `css`, and `js`, and persist the refined result as a new linked version.

#### Scenario: Refinement request produces updated artifact
- **WHEN** an assistant run invokes refinement with valid prior artifact reference and user refinement intent
- **THEN** the system returns a complete regenerated payload incorporating the refinement intent

#### Scenario: Missing previous artifact is rejected
- **WHEN** a refinement invocation is requested without a resolvable prior artifact reference
- **THEN** the system returns a validation error and does not execute model generation

#### Scenario: Successful refinement persists linked version
- **WHEN** a refinement invocation succeeds
- **THEN** the system stores a new version linked to the parent experience lineage in persistence storage

### Requirement: Preserve continuity context across refinements
The system MUST include original intent context, relevant thread context, and prior artifact context when constructing refinement prompts.

#### Scenario: Refinement includes original and previous context
- **WHEN** the system builds a refinement generation request
- **THEN** it includes prior intent context and previous generated artifact context as model inputs

### Requirement: Apply same validation and safety rules as generation
The system MUST run refinement responses through the same payload validation and safety enforcement used for initial generation.

#### Scenario: Refinement output violates schema
- **WHEN** a refinement output is malformed or missing required fields
- **THEN** the system rejects the response with a structured validation error

#### Scenario: Refinement output violates safety guard
- **WHEN** a refinement output contains disallowed patterns such as external resource loading attempts
- **THEN** the system rejects the response and returns a safety error
