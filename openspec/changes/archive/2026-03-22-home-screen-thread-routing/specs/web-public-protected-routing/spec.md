## MODIFIED Requirements

### Requirement: Serve public marketing landing page at root route
The web application SHALL use `/` as a session-aware entrypoint: unauthenticated visitors receive marketing content and authenticated users receive the home workspace.

#### Scenario: Anonymous visitor opens root route
- **WHEN** an unauthenticated visitor requests `/`
- **THEN** the system renders the public marketing landing page

#### Scenario: Authenticated user opens root route
- **WHEN** a user with a valid session requests `/`
- **THEN** the system renders the authenticated home workspace instead of redirecting to another route

### Requirement: Enforce protected application route access
The web application MUST protect `/chat` and its sub-routes so only authenticated users can access chat runtime functionality.

#### Scenario: Unauthenticated user requests protected route
- **WHEN** a visitor without a valid session requests `/chat/<threadId>`
- **THEN** the system redirects to the sign-in flow and does not expose protected chat content

#### Scenario: Authenticated user requests protected route
- **WHEN** a user with a valid session requests `/chat/<threadId>`
- **THEN** the system renders the chat experience for that thread

### Requirement: Provide dedicated authentication routes
The web application SHALL provide dedicated auth routes for sign-in, sign-up, and recovery/reset flows.

#### Scenario: User navigates to auth route
- **WHEN** a visitor opens an auth route under `/auth/*`
- **THEN** the system renders the corresponding auth flow UI and executes the matching auth action

#### Scenario: Authenticated user opens sign-in route
- **WHEN** a user with an active session requests the sign-in route
- **THEN** the system redirects to `/` to avoid duplicate auth onboarding
