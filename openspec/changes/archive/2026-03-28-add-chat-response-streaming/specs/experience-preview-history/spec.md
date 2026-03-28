## MODIFIED Requirements

### Requirement: Provide loading and failure states during generation and refinement
The client SHALL display explicit lifecycle status while conversation and generation tool execution are in-flight, and show model-authored assistant messaging for success/failure outcomes. Preview waiting and failure states MUST use polished creator-centered visuals and copy rather than generic placeholders.

#### Scenario: Loading state during generation
- **WHEN** a conversation run starts and `generate_experience` is pending
- **THEN** the client shows a `creating` status in chat, prevents duplicate conflicting actions per run policy, and presents a purposeful preview-waiting treatment in the sandbox

#### Scenario: Success state after generation
- **WHEN** generation completes and the conversation model emits post-tool output
- **THEN** the client renders the model-authored assistant success message and updated sandbox preview state

#### Scenario: Error state after failed generation
- **WHEN** generation fails and the conversation model emits post-tool output
- **THEN** the client shows actionable error messaging and allows retry via chat flow without hardcoded runtime success/failure copy

#### Scenario: Preview handoff remains visually coherent during streamed chat
- **WHEN** assistant text is streaming before a preview is ready
- **THEN** the preview pane maintains a clear waiting state that stays visually aligned with the active chat progress instead of appearing idle or broken
