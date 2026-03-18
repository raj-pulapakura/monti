# api-jwt-authentication Specification

## Purpose
TBD - created by archiving change add-end-to-end-authentication. Update Purpose after archive.
## Requirements
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

### Requirement: Bind persistence ownership to server-derived auth context
Backend-owned SQL/RPC paths MUST derive user ownership from authenticated token claims (`auth.uid()`) rather than trusting caller-supplied ownership fields.

#### Scenario: RPC request includes forged ownership field
- **WHEN** a caller attempts to submit runtime data with an ownership identifier for another user
- **THEN** the system rejects or ignores caller ownership fields and enforces the authenticated user identity from the validated token context

#### Scenario: RPC function execution privileges are constrained
- **WHEN** runtime RPC functions are exposed to clients
- **THEN** execution privileges are restricted to intended roles (authenticated/service) and not broadly exposed to public callers

### Requirement: Enforce authenticated streaming access
The backend MUST require authenticated user context for runtime event streaming endpoints and limit stream visibility to owned resources.

#### Scenario: Stream request without valid auth
- **WHEN** a client attempts to connect to a runtime event stream without a valid token
- **THEN** the backend denies stream initialization

#### Scenario: Stream request for non-owned thread
- **WHEN** an authenticated user requests a runtime event stream for a thread owned by a different user
- **THEN** the backend rejects the request and does not emit thread events

