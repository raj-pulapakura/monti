## ADDED Requirements

### Requirement: Support multi-provider sign-up and sign-in
The system SHALL provide end-user authentication using Supabase Auth for Google OAuth, Microsoft OAuth, Apple OAuth, and email/password credentials.

#### Scenario: Sign in with OAuth provider
- **WHEN** a user selects Google, Microsoft, or Apple sign-in and the provider callback succeeds
- **THEN** the system creates or resumes the user session and grants access to authenticated routes

#### Scenario: Sign up with email and password
- **WHEN** a user submits a valid email/password sign-up form
- **THEN** the system creates an auth identity and allows authenticated app access in the current development phase without requiring verified email

### Requirement: Support standard password lifecycle flows
The system SHALL support password recovery and reset flows for email/password users, including secure recovery initiation and password update completion.

#### Scenario: Forgot password request
- **WHEN** a user submits a valid email in the forgot-password flow
- **THEN** the system triggers a password recovery email through Supabase Auth without exposing account enumeration details

#### Scenario: Password reset completion
- **WHEN** a user follows a valid recovery link and submits a new compliant password
- **THEN** the system updates the account password and allows subsequent sign-in with the new password

### Requirement: Maintain secure session lifecycle behavior
The system MUST provide secure authenticated session handling for sign-in, refresh continuity, and explicit sign-out across app flows.

#### Scenario: Authenticated session grants app access
- **WHEN** a user has a valid active session
- **THEN** protected app routes and authenticated API calls are permitted for that session identity

#### Scenario: User signs out
- **WHEN** a signed-in user performs sign-out
- **THEN** the system revokes local session state and blocks access to protected routes until re-authentication

### Requirement: Keep email verification optional for access in current phase
The system SHALL keep email verification available but MUST NOT gate full `/app` access on verified email status during the current development phase.

#### Scenario: Unverified email user accesses app
- **WHEN** an authenticated user has an unverified email identity
- **THEN** the system allows access to protected app routes in this phase
