## MODIFIED Requirements

### Requirement: Build complete conversation history including tool exchanges for each LLM turn
The system SHALL include assistant tool-call messages and tool-result messages from `chat_messages` in the conversation history passed to the LLM on every turn, producing a complete and technically correct message sequence per provider API requirements.

#### Scenario: Follow-up user message includes prior tool exchange in history
- **WHEN** a user sends a follow-up message after a previous turn that included a tool call
- **THEN** the conversation history sent to the LLM includes the assistant tool-call message and the tool-result message from the prior turn, in order, between the surrounding user and assistant text messages

#### Scenario: First user message has no prior tool exchange
- **WHEN** a user sends the first message in a thread
- **THEN** the conversation history contains only the system prompt and the user message, with no tool messages

#### Scenario: Tool messages are not omitted from context window
- **WHEN** the conversation history is windowed to the configured context size
- **THEN** tool-role messages and assistant messages with tool calls are included in the window alongside user and assistant text messages

### Requirement: Context window never starts mid-tool-exchange
The system SHALL ensure the context window boundary always falls at a user message boundary, never between an assistant tool-call message and its corresponding tool-result message.

#### Scenario: Window boundary falls inside a tool exchange
- **WHEN** the configured context window size would cause the window to start at an assistant tool-call message or a tool-result message
- **THEN** the window start is snapped backward to the nearest preceding user message so the full exchange is either included or excluded as a unit

#### Scenario: Window boundary falls at a clean user message
- **WHEN** the configured context window size naturally aligns with a user message boundary
- **THEN** no adjustment is made and the window starts at that user message
