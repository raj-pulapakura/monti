## MODIFIED Requirements

### Requirement: Generate interactive learning experience from prompt
The system SHALL accept generation intent from `generate_experience` tool arguments and relevant conversation context, return a structured payload with non-empty `title`, `description`, `html`, `css`, and `js`, and persist the successful result as a versioned artifact.

#### Scenario: Successful generation from tool invocation
- **WHEN** the conversation loop invokes `generate_experience` with prompt intent and optional selectors
- **THEN** the generation engine returns a successful payload containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation persists artifact
- **WHEN** generation completes successfully in the tool executor path
- **THEN** the system stores the generated artifact and generation metadata in persistence storage and returns a structured success tool result

### Requirement: Normalize provider failures for clients
The system MUST map provider-specific generation failures into a consistent tool result error format consumable by conversation orchestration, API responses, and event streams.

#### Scenario: Upstream provider timeout
- **WHEN** the selected provider times out during generation tool execution
- **THEN** the tool executor returns normalized timeout metadata and avoids partial executable payload fields

#### Scenario: Upstream provider refusal
- **WHEN** the selected provider refuses the generation request
- **THEN** the tool executor returns normalized refusal metadata and avoids partial executable payload fields
