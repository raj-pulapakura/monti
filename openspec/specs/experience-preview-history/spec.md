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

### Requirement: Hydrate chat and sandbox state from backend thread source of truth
The client SHALL initialize from backend thread hydration data instead of local preview-first state.

#### Scenario: Initial page load with existing thread
- **WHEN** the user opens a thread that already has messages and sandbox state
- **THEN** the client renders the historical chat timeline and current sandbox preview from backend hydration payload

#### Scenario: Reconnect after stream interruption
- **WHEN** the client reconnects after SSE interruption
- **THEN** it reconciles state using hydration snapshot and resumes event-driven updates

### Requirement: Enter and exit generated experience preview in fullscreen
The client SHALL allow a user to expand an available generated experience to browser fullscreen from the thread workspace while keeping the experience rendered inside the existing sandboxed iframe container and preserving host-controlled exit affordances.

#### Scenario: Enter fullscreen from the preview workspace
- **WHEN** an active experience is available in the thread preview
- **THEN** the client exposes a host-controlled fullscreen action that expands the existing sandbox preview container to browser fullscreen without navigating away from the thread

#### Scenario: Exit fullscreen with browser escape
- **WHEN** the preview is in browser fullscreen and the user presses `Esc`
- **THEN** the client returns the experience to the inline thread preview layout

#### Scenario: Exit fullscreen with host close control
- **WHEN** the preview is in browser fullscreen and the user activates the host-provided close control
- **THEN** the client exits fullscreen without requiring the generated experience to provide its own exit user interface

#### Scenario: Fullscreen keeps preview lifecycle feedback visible
- **WHEN** the preview is fullscreen while the current experience is refreshing or has encountered a preview error
- **THEN** the client continues showing host-owned preview status feedback while preserving the last stable sandboxed experience when one exists

