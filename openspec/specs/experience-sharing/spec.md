## ADDED Requirements

### Requirement: Public experience access by slug
The system SHALL serve the latest version of a generated experience to any unauthenticated requestor given a valid slug, without requiring authentication.

#### Scenario: Valid slug returns experience payload
- **WHEN** a GET request is made to `/api/play/:slug` with a valid, non-archived experience slug
- **THEN** the system returns `{ ok: true, data: { title, html, css, js } }` with HTTP 200

#### Scenario: Unknown slug returns 404
- **WHEN** a GET request is made to `/api/play/:slug` with a slug that does not match any experience
- **THEN** the system returns HTTP 404 with `{ ok: false, error: { code: "VALIDATION_ERROR", message: "Experience not found." } }`

#### Scenario: Archived experience is not served
- **WHEN** a GET request is made to `/api/play/:slug` for an experience that has been archived
- **THEN** the system returns HTTP 404

#### Scenario: Experience with no latest version returns 404
- **WHEN** a GET request is made to `/api/play/:slug` for an experience that exists but has no `latest_version_id`
- **THEN** the system returns HTTP 404

### Requirement: Public play page renders experience without authentication
The system SHALL render a public page at `/play/[slug]` that displays the sandboxed experience iframe to any user without requiring sign-in.

#### Scenario: Valid slug renders experience
- **WHEN** a user navigates to `/play/<slug>` in a browser
- **THEN** the page server-renders the experience in a sandboxed iframe with `allow-scripts` and displays a minimal Monti branding footer

#### Scenario: Invalid slug shows not-found page
- **WHEN** a user navigates to `/play/<slug>` and the backend returns 404
- **THEN** the page renders the Next.js not-found response

#### Scenario: Play page is accessible without authentication
- **WHEN** an unauthenticated user navigates to `/play/<slug>`
- **THEN** the page loads without redirecting to sign-in

### Requirement: Copy shareable link from sandbox panel
The system SHALL provide a copy-link affordance in the sandbox panel that writes the public play URL to the clipboard.

#### Scenario: Copy link button appears when experience has a slug
- **WHEN** the active experience in the sandbox panel has a non-null slug
- **THEN** a copy-link button is visible in the sandbox header actions

#### Scenario: Copy link button is hidden when slug is absent
- **WHEN** the active experience in the sandbox panel has a null slug (e.g., pre-launch experience)
- **THEN** no copy-link button is shown

#### Scenario: Copy link writes URL to clipboard
- **WHEN** the educator clicks the copy-link button
- **THEN** the URL `{origin}/play/{slug}` is written to the system clipboard and the button shows a confirmation state for 2 seconds
