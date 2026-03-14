# experience-refinement Specification

## Purpose
TBD - created by archiving change mvp-generative-learning-loop. Update Purpose after archive.
## Requirements
### Requirement: Refine experience using prior artifact and user intent
The system SHALL accept refinement requests that include prior generated artifact context and user refinement instruction, and SHALL return a full replacement payload with `title`, `description`, `html`, `css`, and `js`.

#### Scenario: Refinement request produces updated artifact
- **WHEN** a user submits a refinement instruction with a valid previous experience payload
- **THEN** the system returns a complete regenerated payload incorporating the refinement intent

#### Scenario: Missing previous artifact is rejected
- **WHEN** a user submits a refinement instruction without required previous payload fields
- **THEN** the system returns a validation error and does not invoke model generation

### Requirement: Preserve continuity context across refinements
The system MUST include original prompt context and prior artifact context when constructing refinement prompts.

#### Scenario: Refinement includes original and previous context
- **WHEN** the system builds a refinement generation request
- **THEN** it includes the original prompt and previous generated artifact as contextual inputs

### Requirement: Apply same validation and safety rules as generation
The system MUST run refinement responses through the same payload validation and safety enforcement used for initial generation.

#### Scenario: Refinement output violates schema
- **WHEN** a refinement output is malformed or missing required fields
- **THEN** the system rejects the response with a structured validation error

#### Scenario: Refinement output violates safety guard
- **WHEN** a refinement output contains disallowed patterns such as external resource loading attempts
- **THEN** the system rejects the response and returns a safety error

