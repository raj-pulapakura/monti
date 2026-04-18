## MODIFIED Requirements

### Requirement: Render session-aware home workspace at root route
The web application SHALL treat `/` as a session-aware home entrypoint: unauthenticated users see marketing content and authenticated users see the home workspace. For any full document navigation to `/` (including first load and hard refresh), the system SHALL resolve authenticated state using server-readable Supabase session material before choosing whether to emit marketing or the home workspace as the primary document content for that route, so that a user with a valid session is not shown only the marketing landing as the initial resolved root experience.

#### Scenario: Unauthenticated visitor opens root route
- **WHEN** a visitor without a valid session requests `/`
- **THEN** the system renders the marketing landing page

#### Scenario: Authenticated user opens root route
- **WHEN** a user with a valid session requests `/`
- **THEN** the system renders the authenticated home workspace with create input and past-creations library

#### Scenario: Authenticated user hard-refreshes root route
- **WHEN** a user with a valid session performs a full document navigation to `/` (including hard refresh)
- **THEN** the initial HTML response does not present the marketing landing page as the chosen authenticated root experience
