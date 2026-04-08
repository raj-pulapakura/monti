## ADDED Requirements

### Requirement: generate_experience tool schema omits format and audience

The tool definition for `generate_experience` exposed to the conversation model SHALL NOT declare `format` or `audience` parameters. The model SHALL express any desired pacing, style, or interaction shape in natural language within the prompt.

#### Scenario: Tool registry lists no format parameter

- **WHEN** the runtime registers or serializes tool definitions for the conversation provider
- **THEN** the `generate_experience` schema does not include a `format` property

#### Scenario: Tool registry lists no audience parameter

- **WHEN** the runtime registers or serializes tool definitions for the conversation provider
- **THEN** the `generate_experience` schema does not include an `audience` property
