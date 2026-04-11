## ADDED Requirements

### Requirement: Cap conversation history sent to the model at a configurable sliding window
The system SHALL limit the number of historical messages included in each conversation model request to the most recent N messages, where N is configurable via the `CONVERSATION_CONTEXT_WINDOW_SIZE` environment variable and defaults to 20. The system prompt SHALL always be included regardless of window size. Messages older than the window SHALL be excluded from the LLM request but SHALL remain persisted in the database and visible in the chat UI.

#### Scenario: Thread has fewer messages than the window size
- **WHEN** a conversation thread has fewer messages than `CONVERSATION_CONTEXT_WINDOW_SIZE`
- **THEN** all messages are included in the LLM request (no truncation occurs)

#### Scenario: Thread exceeds the window size
- **WHEN** a conversation thread has more messages than `CONVERSATION_CONTEXT_WINDOW_SIZE`
- **THEN** only the most recent `CONVERSATION_CONTEXT_WINDOW_SIZE` messages are sent to the conversation model; older messages are excluded from the LLM request

#### Scenario: System prompt is always included
- **WHEN** any conversation turn is executed, regardless of thread length
- **THEN** the system prompt is always prepended to the message list sent to the model, and it does not count against the sliding window message count

#### Scenario: Window size is configurable via environment variable
- **WHEN** `CONVERSATION_CONTEXT_WINDOW_SIZE` is set to a valid positive integer
- **THEN** that value is used as the sliding window size instead of the default of 20

#### Scenario: Invalid window size value falls back to default
- **WHEN** `CONVERSATION_CONTEXT_WINDOW_SIZE` is set to a non-positive integer or a non-numeric string
- **THEN** the system falls back to the default window size of 20

#### Scenario: Excluded messages remain accessible in the UI
- **WHEN** messages are excluded from the LLM request due to the sliding window
- **THEN** those messages remain persisted in the database and are still rendered in the chat thread UI for the user to view
