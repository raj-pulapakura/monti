## MODIFIED Requirements

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
