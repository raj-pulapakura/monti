# web-public-protected-routing Specification

## Purpose
TBD - created by archiving change add-end-to-end-authentication. Update Purpose after archive.
## Requirements
### Requirement: Serve public marketing landing page at root route
The web application SHALL serve marketing content at `/` without requiring authentication.

#### Scenario: Anonymous visitor opens root route
- **WHEN** an unauthenticated visitor requests `/`
- **THEN** the system renders the public landing page and does not require sign-in

### Requirement: Enforce protected application route access
The web application MUST protect `/app` and its sub-routes so only authenticated users can access application functionality.

#### Scenario: Unauthenticated user requests protected route
- **WHEN** a visitor without a valid session requests `/app`
- **THEN** the system redirects to the sign-in flow and does not expose protected app content

#### Scenario: Authenticated user requests protected route
- **WHEN** a user with a valid session requests `/app`
- **THEN** the system renders the application experience

### Requirement: Provide dedicated authentication routes
The web application SHALL provide dedicated auth routes for sign-in, sign-up, and recovery/reset flows.

#### Scenario: User navigates to auth route
- **WHEN** a visitor opens an auth route under `/auth/*`
- **THEN** the system renders the corresponding auth flow UI and executes the matching auth action

#### Scenario: Authenticated user opens sign-in route
- **WHEN** a user with an active session requests the sign-in route
- **THEN** the system redirects to `/app` to avoid duplicate auth onboarding

