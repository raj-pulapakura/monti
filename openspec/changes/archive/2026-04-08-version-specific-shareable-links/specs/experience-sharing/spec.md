## MODIFIED Requirements

### Requirement: Public experience access by slug
The system SHALL serve the content of a generated experience to any unauthenticated requestor given a valid slug, and optionally a version number. When no version number is supplied the system returns the latest version; when a version number is supplied it returns that specific version.

#### Scenario: Valid slug with no version param returns latest version
- **WHEN** a GET request is made to `/api/play/:slug` with no `v` query param
- **THEN** the system returns `{ ok: true, data: { title, html, css, js } }` for the experience's `latest_version_id` with HTTP 200

#### Scenario: Valid slug with valid version number returns that version
- **WHEN** a GET request is made to `/api/play/:slug?v=2` and version 2 exists with `generation_status = 'succeeded'`
- **THEN** the system returns `{ ok: true, data: { title, html, css, js } }` for version 2 with HTTP 200

#### Scenario: Valid slug with non-existent version number returns 404
- **WHEN** a GET request is made to `/api/play/:slug?v=99` and version 99 does not exist for that experience
- **THEN** the system returns HTTP 404 with `{ ok: false, error: { code: "VALIDATION_ERROR", message: "Experience not found." } }`

#### Scenario: Non-integer version param returns 400
- **WHEN** a GET request is made to `/api/play/:slug?v=abc`
- **THEN** the system returns HTTP 400

#### Scenario: Unknown slug returns 404
- **WHEN** a GET request is made to `/api/play/:slug` with a slug that does not match any experience
- **THEN** the system returns HTTP 404 with `{ ok: false, error: { code: "VALIDATION_ERROR", message: "Experience not found." } }`

#### Scenario: Archived experience is not served
- **WHEN** a GET request is made to `/api/play/:slug` for an experience that has been archived
- **THEN** the system returns HTTP 404

#### Scenario: Experience with no latest version returns 404
- **WHEN** a GET request is made to `/api/play/:slug` for an experience that exists but has no `latest_version_id` and no `v` param
- **THEN** the system returns HTTP 404

### Requirement: Copy shareable link from sandbox panel
The system SHALL provide a copy-link affordance in the sandbox panel that writes the public play URL to the clipboard. When the user is viewing a non-latest version the URL SHALL encode the viewed version number as a `?v=N` query param. When the user is on the latest version the URL SHALL be unversioned.

#### Scenario: Copy link writes unversioned URL when viewing latest version
- **WHEN** the educator clicks the copy-link button while on the latest version (or with no version pinned)
- **THEN** the URL `{origin}/play/{slug}` (no `?v=` param) is written to the system clipboard and the button shows a confirmation state for 2 seconds

#### Scenario: Copy link writes versioned URL when viewing a non-latest version
- **WHEN** the educator clicks the copy-link button while `viewingVersionId` corresponds to a version that is not the latest
- **THEN** the URL `{origin}/play/{slug}?v={versionNumber}` is written to the clipboard and the button shows a confirmation state for 2 seconds

#### Scenario: Copy link button tooltip signals pinned version
- **WHEN** the copy-link button is rendered while the user is viewing a non-latest version
- **THEN** the button tooltip reads "Copy link to v*N*" where N is the viewed version number

#### Scenario: Copy link button tooltip is generic when on latest
- **WHEN** the copy-link button is rendered while the user is on the latest version
- **THEN** the button tooltip reads "Copy link"

#### Scenario: Copy link button appears when experience has a slug
- **WHEN** the active experience in the sandbox panel has a non-null slug
- **THEN** a copy-link button is visible in the sandbox header actions

#### Scenario: Copy link button is hidden when slug is absent
- **WHEN** the active experience in the sandbox panel has a null slug
- **THEN** no copy-link button is shown

## ADDED Requirements

### Requirement: Public play page resolves versioned URL
The system SHALL render the correct version of an experience when the `/play/[slug]` page is loaded with a `?v=N` query parameter.

#### Scenario: Play page with version param renders that version
- **WHEN** a user navigates to `/play/<slug>?v=2`
- **THEN** the page fetches `/api/play/<slug>?v=2` and renders the content of version 2 in the sandboxed iframe

#### Scenario: Play page without version param renders latest
- **WHEN** a user navigates to `/play/<slug>` with no `v` param
- **THEN** the page fetches `/api/play/<slug>` and renders the latest version (unchanged behavior)

#### Scenario: Play page with invalid version shows not-found
- **WHEN** a user navigates to `/play/<slug>?v=99` and version 99 does not exist
- **THEN** the page renders the not-found state
