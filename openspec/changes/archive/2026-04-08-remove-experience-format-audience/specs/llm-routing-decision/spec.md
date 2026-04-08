## ADDED Requirements

### Requirement: Router input excludes structured format and audience tool fields

The system SHALL NOT supply structured `format` or `audience` values from `generate_experience` tool arguments into the routing inference request, because those parameters are not part of the tool contract. Routing SHALL rely on prompt text, operation kind, refinement context, and other remaining structured fields.

#### Scenario: Generate route summary has no format or audience lines

- **WHEN** the runtime builds router user input for a `generate` operation
- **THEN** the router request text does not include `- format:` or `- audience:` lines derived from tool arguments

#### Scenario: Refine route summary has no format or audience lines

- **WHEN** the runtime builds router user input for a `refine` operation
- **THEN** the router request text does not include `- format:` or `- audience:` lines derived from tool arguments
