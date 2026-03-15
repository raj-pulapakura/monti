## MODIFIED Requirements

### Requirement: Generate interactive learning experience from prompt
The system SHALL accept generation intent from chat context and tool arguments, return a structured experience payload with non-empty `title`, `description`, `html`, `css`, and `js` fields, and persist the successful result as a versioned experience artifact.

#### Scenario: Successful generation with format and audience
- **WHEN** an assistant run invokes the generation tool with prompt intent and `format=quiz` and `audience=elementary`
- **THEN** the tool returns a successful payload containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation with prompt only
- **WHEN** an assistant run invokes the generation tool with prompt intent and no optional selectors
- **THEN** the tool returns a successful payload containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation persists artifact
- **WHEN** generation tool execution completes successfully and output is returned to the assistant run
- **THEN** the system stores the generated artifact and generation metadata in persistence storage

### Requirement: Enforce structured output validation
The system MUST validate generated output shape and reject responses that are not valid structured payloads.

#### Scenario: Invalid model payload is rejected
- **WHEN** model output is missing one of `html`, `css`, or `js`
- **THEN** the system marks the tool invocation as failed and does not return partial executable output to the sandbox

#### Scenario: Oversized generated part is rejected
- **WHEN** generated `html`, `css`, or `js` exceeds configured size limits
- **THEN** the system marks the tool invocation as failed and returns validation error metadata

### Requirement: Normalize provider failures for clients
The system MUST map provider-specific errors into a consistent API and runtime event error format.

#### Scenario: Upstream provider timeout
- **WHEN** the selected LLM provider times out during generation tool execution
- **THEN** the system records and emits a normalized timeout error with retry guidance

#### Scenario: Upstream provider refusal
- **WHEN** the selected LLM provider refuses the generation request
- **THEN** the system records and emits a normalized refusal error without executable payload fields
