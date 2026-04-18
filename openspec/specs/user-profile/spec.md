# user-profile Specification

## Purpose
TBD - created by archiving change user-onboarding-flow. Update Purpose after archive.
## Requirements
### Requirement: Store user profile data
The system SHALL persist a user profile record containing role, context, optional free-text role description, and onboarding completion timestamp. Each user SHALL have at most one profile record.

#### Scenario: Profile created on onboarding completion
- **WHEN** a user completes the onboarding modal
- **THEN** a `user_profiles` row is created with role, context, role_other_text (if applicable), and onboarding_completed_at set to current timestamp

#### Scenario: Profile is user-scoped
- **WHEN** a user fetches their profile
- **THEN** they receive only their own profile record (RLS enforced)

### Requirement: Expose profile read/write API
The system SHALL provide authenticated endpoints to read and update the user's profile.

#### Scenario: Authenticated user fetches their profile
- **WHEN** a GET request is made to the profile endpoint with a valid JWT
- **THEN** the response contains the user's role, context, role_other_text, and onboarding_completed_at

#### Scenario: Authenticated user updates their profile
- **WHEN** a PATCH request is made to the profile endpoint with valid role and context fields
- **THEN** the profile is updated and the updated record is returned

#### Scenario: Unauthenticated profile request is rejected
- **WHEN** a request is made to the profile endpoint without a valid JWT
- **THEN** the response is 401 Unauthorized

### Requirement: Inject user profile into AI conversation system prompt
The system SHALL prepend a concise user context block to the conversation system prompt when the user has a completed profile.

#### Scenario: Conversation with completed profile
- **WHEN** a conversation is started AND the user has a non-null onboarding_completed_at
- **THEN** the system prompt includes a user context block stating the user's role and setting (e.g. "The user is an educator working in a K-12 school.")

#### Scenario: Conversation without completed profile
- **WHEN** a conversation is started AND the user has no profile or null onboarding_completed_at
- **THEN** the system prompt is unchanged (no user context block injected)

#### Scenario: "Something else" role is not injected verbatim
- **WHEN** the user's role is "other" AND role_other_text is set
- **THEN** the injected context describes them as a user with a custom role but does NOT include the raw free-text string

