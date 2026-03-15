## MODIFIED Requirements

### Requirement: Provide loading and failure states during generation and refinement
The client SHALL display explicit lifecycle status while conversation and generation tool execution are in-flight, and show model-authored assistant messaging for success/failure outcomes.

#### Scenario: Loading state during generation
- **WHEN** a conversation run starts and `generate_experience` is pending
- **THEN** the client shows a `creating` status in chat and prevents duplicate conflicting actions per run policy

#### Scenario: Success state after generation
- **WHEN** generation completes and the conversation model emits post-tool output
- **THEN** the client renders the model-authored assistant success message and updated sandbox preview state

#### Scenario: Error state after failed generation
- **WHEN** generation fails and the conversation model emits post-tool output
- **THEN** the client shows actionable error messaging and allows retry via chat flow without hardcoded runtime success/failure copy
