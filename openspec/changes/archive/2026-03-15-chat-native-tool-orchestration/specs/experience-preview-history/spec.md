## MODIFIED Requirements

### Requirement: Render generated experience in sandboxed iframe
The client MUST render generated `html`/`css`/`js` output exclusively inside a sandboxed iframe configuration that allows script execution but restricts top-level navigation and external origin access.

#### Scenario: Render generated experience in sandbox container
- **WHEN** the client receives a valid thread sandbox state with active artifact payload
- **THEN** it renders the experience inside a sandboxed iframe preview area

#### Scenario: Direct DOM injection is not used for preview
- **WHEN** the client displays generated output
- **THEN** it does not inject generated markup directly into the host application DOM

### Requirement: Provide loading and failure states during generation and refinement
The client SHALL display explicit lifecycle status while assistant runs and tool invocations are in-flight, and clear error messaging when run/tool execution fails.

#### Scenario: Loading state during generation
- **WHEN** a run starts and generation/refinement tool invocation is pending
- **THEN** the client shows a `creating` status in chat and prevents duplicate conflicting actions per run policy

#### Scenario: Error state after failed generation
- **WHEN** run or tool execution fails due to validation, routing, or provider errors
- **THEN** the client shows an actionable error message and allows retry via chat flow

## ADDED Requirements

### Requirement: Hydrate chat and sandbox state from backend thread source of truth
The client SHALL initialize from backend thread hydration data instead of local preview-first state.

#### Scenario: Initial page load with existing thread
- **WHEN** the user opens a thread that already has messages and sandbox state
- **THEN** the client renders the historical chat timeline and current sandbox preview from backend hydration payload

#### Scenario: Reconnect after stream interruption
- **WHEN** the client reconnects after SSE interruption
- **THEN** it reconciles state using hydration snapshot and resumes event-driven updates

## REMOVED Requirements

### Requirement: Persist recent creations locally with bounded history
**Reason**: The product model now uses server-persisted thread timelines and sandbox state as the canonical history source, making local-only recent creation storage redundant and inconsistent.
**Migration**: Frontend history UX MUST read from thread/message hydration APIs and remove local-storage-only recent creations as the primary persisted history mechanism.
