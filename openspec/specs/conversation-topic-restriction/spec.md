# conversation-topic-restriction Specification

## Purpose
Steer the conversation model toward educational experience design topics via the system prompt, with operator override via environment variable.

## Requirements

### Requirement: Conversation model restricts responses to educational experience design topics
The system SHALL configure the conversation model with a system prompt that instructs it to redirect responses outside of educational experience design topics back to experience building. The model SHALL NOT issue hard refusals on adjacent questions that legitimately inform experience design. The restriction SHALL be enforced solely via system prompt; no server-side classification is required.

#### Scenario: User asks an off-topic question (e.g., "write me an essay")
- **WHEN** a user sends a message unrelated to learning experience design
- **THEN** the conversation model responds with a redirect that steers the user toward experience building rather than fulfilling the off-topic request or issuing a hard refusal

#### Scenario: User asks an adjacent question (e.g., "what makes a good quiz layout?")
- **WHEN** a user asks a question that is adjacent to experience design (could inform how an experience is built)
- **THEN** the conversation model answers the question normally, treating it as within scope

#### Scenario: System prompt is overridden via environment variable
- **WHEN** the `CONVERSATION_SYSTEM_PROMPT` environment variable is set to a non-empty string
- **THEN** the conversation model uses that value as its system prompt instead of the default, allowing operators to adjust topic restriction without a code deploy
