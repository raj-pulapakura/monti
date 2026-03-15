# experience-refinement Specification

## Purpose
TBD - created by archiving change mvp-generative-learning-loop. Update Purpose after archive.
## Requirements
### Requirement: Refine experience using prior artifact and user intent
The system SHALL execute refinement through `generate_experience` tool invocations that include prior artifact linkage and user refinement intent, returning a full replacement payload with `title`, `description`, `html`, `css`, and `js`.

#### Scenario: Refinement via tool invocation produces updated artifact
- **WHEN** the conversation loop invokes refinement with valid prior artifact reference and user refinement intent
- **THEN** the system returns a complete regenerated payload incorporating the refinement intent

#### Scenario: Missing previous artifact is rejected
- **WHEN** a refinement tool invocation is requested without a resolvable prior artifact reference
- **THEN** the system returns a validation error tool result and does not execute model generation

#### Scenario: Successful refinement persists linked version
- **WHEN** a refinement tool invocation succeeds
- **THEN** the system stores a new version linked to the parent experience lineage and returns a structured success tool result

### Requirement: Preserve continuity context across refinements
The system MUST include original intent context, relevant conversation context, and prior artifact context when constructing refinement prompts.

#### Scenario: Refinement includes conversation and artifact context
- **WHEN** the system builds a refinement generation request from a tool invocation
- **THEN** it includes prior intent context, previous generated artifact context, and relevant thread conversation context as model inputs

### Requirement: Apply same validation and safety rules as generation
The system MUST run refinement responses through the same payload validation and safety enforcement used for initial generation.

#### Scenario: Refinement output violates schema
- **WHEN** a refinement output is malformed or missing required fields
- **THEN** the system rejects the response with a structured validation error

#### Scenario: Refinement output violates safety guard
- **WHEN** a refinement output contains disallowed patterns such as external resource loading attempts
- **THEN** the system rejects the response and returns a safety error

