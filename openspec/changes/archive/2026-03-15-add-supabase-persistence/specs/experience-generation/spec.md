## MODIFIED Requirements

### Requirement: Generate interactive learning experience from prompt
The system SHALL accept a generation request containing user prompt text and optional format and audience metadata, return a structured experience payload with non-empty `title`, `description`, `html`, `css`, and `js` fields, and persist the successful result as a versioned experience artifact.

#### Scenario: Successful generation with format and audience
- **WHEN** a user submits prompt text with `format=quiz` and `audience=elementary`
- **THEN** the system returns a successful response containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation with prompt only
- **WHEN** a user submits prompt text without optional selectors
- **THEN** the system returns a successful response containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation persists artifact
- **WHEN** generation completes successfully and the response is returned
- **THEN** the system stores the generated artifact and generation metadata in persistence storage
