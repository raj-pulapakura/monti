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

### Requirement: Expose ordered version list alongside sandbox state
The backend SHALL include ordered version metadata in the sandbox preview response so the client can render navigation controls without a separate request.

#### Scenario: Sandbox response includes version list when experience exists
- **WHEN** `GET /api/chat/threads/:threadId/sandbox` is called and the sandbox has an active experience
- **THEN** the response includes `allVersions` — an array of `{id, versionNumber, promptSummary}` ordered ascending by `version_number`, covering only versions with `generation_status = 'succeeded'`

#### Scenario: Sandbox response returns empty version list when no experience
- **WHEN** `GET /api/chat/threads/:threadId/sandbox` is called and the sandbox has no active experience
- **THEN** `allVersions` is an empty array

### Requirement: Serve full version content for a specific version
The backend SHALL provide a thread-scoped endpoint that returns the full renderable content of any succeeded version belonging to the active experience, verified against thread ownership. The response SHALL contain `{html, css, js}` only — title is NOT included, as it belongs to the experience record and does not vary per version.

#### Scenario: Return version content for an owned thread
- **WHEN** `GET /api/chat/threads/:threadId/experience-versions/:versionId` is called by the thread owner
- **THEN** the response includes `{html, css, js}` for that version (title is not included)

#### Scenario: Reject version content request for unowned thread
- **WHEN** `GET /api/chat/threads/:threadId/experience-versions/:versionId` is called and the thread does not belong to the authenticated user
- **THEN** the backend returns a validation error and does not serve version content

#### Scenario: Return not-found when version does not belong to thread's experience
- **WHEN** a valid `versionId` is requested but does not belong to the experience associated with the thread's sandbox state
- **THEN** the backend returns a not-found error

### Requirement: Sandbox preview response includes experience title from the experience record
The backend SHALL return the experience title from `experiences.title` (not from `experience_versions`) in the sandbox preview response. The title SHALL be stable regardless of which version is active.

#### Scenario: Sandbox preview title comes from experiences table
- **WHEN** `GET /api/chat/threads/:threadId/sandbox` is called and the sandbox has an active experience
- **THEN** the `activeExperience.title` in the response is sourced from `experiences.title`, not from any version record

#### Scenario: Version switch does not change the displayed title
- **WHEN** the user navigates to a different version in the sandbox
- **THEN** the experience title displayed in the sandbox header remains unchanged

### Requirement: Display version navigation controls in sandbox header
The client SHALL render prev/next chevron buttons and a "vN of M" indicator in the sandbox panel header when more than one succeeded version exists for the active experience. The copy-link button tooltip SHALL reflect whether a pinned or floating URL will be copied based on the currently viewed version.

#### Scenario: Version nav shown when multiple versions exist
- **WHEN** the sandbox state has an active experience with two or more succeeded versions
- **THEN** the sandbox header shows a previous-version button, a "vN of M" label, and a next-version button

#### Scenario: Version nav hidden when only one version exists
- **WHEN** the sandbox state has an active experience with exactly one succeeded version
- **THEN** no version navigation controls are rendered

#### Scenario: Previous button disabled on first version
- **WHEN** the user is viewing version 1
- **THEN** the previous-version button is visually disabled and not interactive

#### Scenario: Next button disabled on latest version
- **WHEN** the user is viewing the most recent version
- **THEN** the next-version button is visually disabled and not interactive

#### Scenario: Prompt summary visible on version indicator hover
- **WHEN** the user hovers over the "vN of M" indicator
- **THEN** a tooltip shows the `promptSummary` for the currently viewed version

#### Scenario: Copy link tooltip shows pinned version when viewing non-latest
- **WHEN** the user is viewing a non-latest version via version navigation
- **THEN** the copy-link button tooltip reads "Copy link to v*N*"

#### Scenario: Copy link tooltip is generic when on latest version
- **WHEN** the user is on the latest version (default state or navigated back to latest)
- **THEN** the copy-link button tooltip reads "Copy link"

### Requirement: Navigate to and display an older experience version
The client SHALL load and render the full content of an older version when the user navigates backwards, without affecting the canonical sandbox state.

#### Scenario: Clicking previous loads older version content
- **WHEN** the user clicks the previous-version button
- **THEN** the client fetches the content for the preceding version and renders it in the sandbox iframe

#### Scenario: Clicking next loads newer version content
- **WHEN** the user clicks the next-version button while viewing a version that is not the latest
- **THEN** the client fetches the content for the next version and renders it in the sandbox iframe

#### Scenario: Sandbox state is not mutated when viewing older version
- **WHEN** the user navigates to an older version
- **THEN** `sandbox_states.experience_version_id` in the database is not modified

### Requirement: Reset viewed version to latest on new prompt submission
The client SHALL clear any version pin and display the latest version whenever the user submits a new prompt.

#### Scenario: Version pin clears on prompt submit
- **WHEN** the user submits a new message while viewing an older version
- **THEN** the viewed version resets to the latest and the version pin is cleared

### Requirement: Nudge user when a new version is generated while viewing an older one
The client SHALL surface a non-disruptive affordance when a new version becomes available while the user is pinned to an older version, rather than auto-jumping.

#### Scenario: New version nudge appears while pinned to older version
- **WHEN** `sandboxState.experienceVersionId` updates (new generation complete) and the user is currently viewing an older version
- **THEN** the client shows a "New version available" affordance in the sandbox panel

#### Scenario: Dismissing nudge or clicking it jumps to latest
- **WHEN** the user interacts with the "New version available" affordance
- **THEN** the viewed version resets to the latest and the nudge is dismissed
