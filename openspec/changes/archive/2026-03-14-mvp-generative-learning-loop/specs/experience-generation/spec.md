## ADDED Requirements

### Requirement: Generate interactive learning experience from prompt
The system SHALL accept a generation request containing user prompt text and optional format and audience metadata, and return a structured experience payload with non-empty `title`, `description`, `html`, `css`, and `js` fields.

#### Scenario: Successful generation with format and audience
- **WHEN** a user submits prompt text with `format=quiz` and `audience=elementary`
- **THEN** the system returns a successful response containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation with prompt only
- **WHEN** a user submits prompt text without optional selectors
- **THEN** the system returns a successful response containing `title`, `description`, `html`, `css`, and `js`

### Requirement: Enforce structured output validation
The system MUST validate generated output shape and reject responses that are not valid structured payloads.

#### Scenario: Invalid model payload is rejected
- **WHEN** model output is missing one of `html`, `css`, or `js`
- **THEN** the system responds with a generation error and does not return partial executable output

#### Scenario: Oversized generated part is rejected
- **WHEN** generated `html`, `css`, or `js` exceeds configured size limits
- **THEN** the system responds with a generation error indicating output exceeded limits

### Requirement: Normalize provider failures for clients
The system MUST map provider-specific errors into a consistent API error response format.

#### Scenario: Upstream provider timeout
- **WHEN** the selected LLM provider times out during generation
- **THEN** the system returns a normalized timeout error with retry guidance

#### Scenario: Upstream provider refusal
- **WHEN** the selected LLM provider refuses the request
- **THEN** the system returns a normalized refusal error without executable payload fields
