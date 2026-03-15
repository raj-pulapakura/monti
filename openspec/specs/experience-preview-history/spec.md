# experience-preview-history Specification

## Purpose
TBD - created by archiving change mvp-generative-learning-loop. Update Purpose after archive.
## Requirements
### Requirement: Render generated experience in sandboxed iframe
The client MUST render generated `html`/`css`/`js` output exclusively inside a sandboxed iframe configuration that allows script execution but restricts top-level navigation and external origin access.

#### Scenario: Render generated experience in sandbox container
- **WHEN** the client receives a valid thread sandbox state with active artifact payload
- **THEN** it renders the experience inside a sandboxed iframe preview area

#### Scenario: Direct DOM injection is not used for preview
- **WHEN** the client displays generated output
- **THEN** it does not inject generated markup directly into the host application DOM

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

### Requirement: Hydrate chat and sandbox state from backend thread source of truth
The client SHALL initialize from backend thread hydration data instead of local preview-first state.

#### Scenario: Initial page load with existing thread
- **WHEN** the user opens a thread that already has messages and sandbox state
- **THEN** the client renders the historical chat timeline and current sandbox preview from backend hydration payload

#### Scenario: Reconnect after stream interruption
- **WHEN** the client reconnects after SSE interruption
- **THEN** it reconciles state using hydration snapshot and resumes event-driven updates

