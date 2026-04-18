## MODIFIED Requirements

### Requirement: Serve public marketing landing page at root route
The web application SHALL use `/` as a session-aware entrypoint: unauthenticated visitors receive marketing content and authenticated users receive the home workspace. The system SHALL refresh and read the cookie-backed Supabase session on matched application requests (for example via Next.js middleware using `@supabase/ssr`) so that server-side handling of `/` uses the same refreshed session view as protected routing decisions.

#### Scenario: Anonymous visitor opens root route
- **WHEN** an unauthenticated visitor requests `/`
- **THEN** the system renders the public marketing landing page

#### Scenario: Authenticated user opens root route
- **WHEN** a user with a valid session requests `/`
- **THEN** the system renders the authenticated home workspace instead of redirecting to another route

#### Scenario: Authenticated user hard-refreshes root route
- **WHEN** a user with a valid session performs a full document navigation to `/` (including hard refresh)
- **THEN** the initial HTML response does not render the marketing landing page as the sole root content prior to the authenticated home workspace
