## MODIFIED Requirements

### Requirement: Generate interactive learning experience from prompt

The system SHALL accept generation intent from `generate_experience` tool arguments and relevant conversation context. Generation intent SHALL consist of the topic prompt and operational fields required by the runtime (e.g. operation, refinement instruction when refining); it SHALL NOT include structured `format` or `audience` selectors. The system SHALL return a structured payload with non-empty `title`, `description`, `html`, `css`, and `js`, and persist the successful result as a versioned artifact.

#### Scenario: Successful generation from tool invocation

- **WHEN** the conversation loop invokes `generate_experience` with prompt intent and optional conversation context
- **THEN** the generation engine returns a successful payload containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation persists artifact

- **WHEN** generation completes successfully in the tool executor path
- **THEN** the system stores the generated artifact and generation metadata in persistence storage and returns a structured success tool result
