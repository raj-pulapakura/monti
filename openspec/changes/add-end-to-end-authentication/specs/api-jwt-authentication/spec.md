## ADDED Requirements

### Requirement: Require valid bearer JWT for protected API endpoints
The backend MUST require a valid Supabase access token for protected runtime and persistence API endpoints.

#### Scenario: Protected endpoint request without token
- **WHEN** a request to a protected endpoint omits an authorization bearer token
- **THEN** the backend returns an authentication error and does not execute protected business logic

#### Scenario: Protected endpoint request with valid token
- **WHEN** a request includes a valid Supabase bearer token
- **THEN** the backend allows endpoint execution under the authenticated user principal

### Requirement: Validate Supabase token integrity and claims
The backend MUST validate token signature and required claims against Supabase issuer/audience expectations before trusting identity.

#### Scenario: Expired or invalid token
- **WHEN** a request includes an expired, malformed, or signature-invalid token
- **THEN** the backend rejects the request as unauthorized

#### Scenario: Token with valid identity claims
- **WHEN** a request includes a valid token containing a user identifier claim
- **THEN** the backend sets the authenticated user context for downstream service and repository access control

### Requirement: Enforce authenticated streaming access
The backend MUST require authenticated user context for runtime event streaming endpoints and limit stream visibility to owned resources.

#### Scenario: Stream request without valid auth
- **WHEN** a client attempts to connect to a runtime event stream without a valid token
- **THEN** the backend denies stream initialization

#### Scenario: Stream request for non-owned thread
- **WHEN** an authenticated user requests a runtime event stream for a thread owned by a different user
- **THEN** the backend rejects the request and does not emit thread events
