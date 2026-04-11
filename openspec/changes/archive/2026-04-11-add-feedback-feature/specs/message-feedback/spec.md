## ADDED Requirements

### Requirement: Thumbs controls appear beneath each assistant message
The system SHALL render a thumbs up and thumbs down button beneath every assistant message in the conversation timeline. The controls SHALL NOT appear on user messages, tool messages, or system messages.

#### Scenario: Assistant message has thumbs controls
- **WHEN** the conversation timeline renders a message with `role: 'assistant'`
- **THEN** a thumbs up button and a thumbs down button are visible beneath the message content

#### Scenario: User message has no thumbs controls
- **WHEN** the conversation timeline renders a message with `role: 'user'`
- **THEN** no thumbs controls are rendered for that message

### Requirement: Thumbs click opens a prompted feedback modal
The system SHALL open a modal when the user clicks either thumbs button. The modal SHALL display a prompt tailored to the sentiment: thumbs up prompts "What was satisfying about this response?", thumbs down prompts "What was unsatisfying about this response?". The modal SHALL contain a text area and a submit button.

#### Scenario: Thumbs up opens positive prompt
- **WHEN** the user clicks the thumbs up button on an assistant message
- **THEN** a modal opens with the prompt "What was satisfying about this response?" and a text area

#### Scenario: Thumbs down opens negative prompt
- **WHEN** the user clicks the thumbs down button on an assistant message
- **THEN** a modal opens with the prompt "What was unsatisfying about this response?" and a text area

#### Scenario: Modal closes on dismiss
- **WHEN** the user clicks outside the modal or a dismiss control without submitting
- **THEN** the modal closes and any typed text is discarded

### Requirement: Message feedback is persisted with full context
The system SHALL submit feedback to `POST /api/feedback` with `kind: 'thumbs_up'` or `'thumbs_down'`, the user's optional message text, and the contextual identifiers available at submission time: `thread_id`, `message_id`, and `experience_id` (nullable if no experience is active). Submission SHALL be allowed even if the text area is empty.

#### Scenario: Thumbs up submitted with message
- **WHEN** the user types text and submits the thumbs up modal
- **THEN** a request is sent with `{ kind: 'thumbs_up', message: <text>, thread_id, message_id, experience_id }` and a feedback row is created

#### Scenario: Thumbs down submitted without message
- **WHEN** the user submits the thumbs down modal with an empty text area
- **THEN** a request is sent with `{ kind: 'thumbs_down', message: null, thread_id, message_id, experience_id }` and a feedback row is created

#### Scenario: Failed submission shows error
- **WHEN** the backend returns an error or the request fails
- **THEN** the modal remains open and an error message is displayed

### Requirement: Thumbs UI is stateless across sessions
The system SHALL NOT persist or display which thumbs option (if any) was previously selected for a given message. Each page load SHALL render thumbs controls in their default unselected state regardless of prior submissions.

#### Scenario: Page reload resets thumbs state
- **WHEN** the user reloads the chat page after submitting thumbs feedback
- **THEN** the thumbs controls for the rated message appear in the default unselected state

#### Scenario: Second click on same message inserts new row
- **WHEN** the user submits thumbs feedback on a message and then clicks a thumbs button again on the same message in the same session
- **THEN** the modal opens in its default blank state and a new feedback row is inserted on submission
