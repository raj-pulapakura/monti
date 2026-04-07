## ADDED Requirements

### Requirement: Expose ordered version list alongside sandbox state
The backend SHALL include ordered version metadata in the sandbox preview response so the client can render navigation controls without a separate request.

#### Scenario: Sandbox response includes version list when experience exists
- **WHEN** `GET /api/chat/threads/:threadId/sandbox` is called and the sandbox has an active experience
- **THEN** the response includes `allVersions` — an array of `{id, versionNumber, promptSummary}` ordered ascending by `version_number`, covering only versions with `generation_status = 'succeeded'`

#### Scenario: Sandbox response returns empty version list when no experience
- **WHEN** `GET /api/chat/threads/:threadId/sandbox` is called and the sandbox has no active experience
- **THEN** `allVersions` is an empty array

---

### Requirement: Serve full version content for a specific version
The backend SHALL provide a thread-scoped endpoint that returns the full renderable content of any succeeded version belonging to the active experience, verified against thread ownership.

#### Scenario: Return version content for an owned thread
- **WHEN** `GET /api/chat/threads/:threadId/experience-versions/:versionId` is called by the thread owner
- **THEN** the response includes `{title, html, css, js}` for that version

#### Scenario: Reject version content request for unowned thread
- **WHEN** `GET /api/chat/threads/:threadId/experience-versions/:versionId` is called and the thread does not belong to the authenticated user
- **THEN** the backend returns a validation error and does not serve version content

#### Scenario: Return not-found when version does not belong to thread's experience
- **WHEN** a valid `versionId` is requested but does not belong to the experience associated with the thread's sandbox state
- **THEN** the backend returns a not-found error

---

### Requirement: Display version navigation controls in sandbox header
The client SHALL render prev/next chevron buttons and a "vN of M" indicator in the sandbox panel header when more than one succeeded version exists for the active experience.

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

---

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

---

### Requirement: Reset viewed version to latest on new prompt submission
The client SHALL clear any version pin and display the latest version whenever the user submits a new prompt.

#### Scenario: Version pin clears on prompt submit
- **WHEN** the user submits a new message while viewing an older version
- **THEN** the viewed version resets to the latest and the version pin is cleared

---

### Requirement: Nudge user when a new version is generated while viewing an older one
The client SHALL surface a non-disruptive affordance when a new version becomes available while the user is pinned to an older version, rather than auto-jumping.

#### Scenario: New version nudge appears while pinned to older version
- **WHEN** `sandboxState.experienceVersionId` updates (new generation complete) and the user is currently viewing an older version
- **THEN** the client shows a "New version available" affordance in the sandbox panel

#### Scenario: Dismissing nudge or clicking it jumps to latest
- **WHEN** the user interacts with the "New version available" affordance
- **THEN** the viewed version resets to the latest and the nudge is dismissed
