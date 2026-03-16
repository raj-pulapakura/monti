## ADDED Requirements

### Requirement: Enforce authenticated ownership for thread runtime operations
The system MUST scope chat thread creation, hydration, message submission, sandbox preview, and runtime event streaming to the authenticated thread owner.

#### Scenario: Authenticated owner accesses thread runtime
- **WHEN** an authenticated user requests runtime operations for a thread they own
- **THEN** the system allows access and returns only records owned by that user

#### Scenario: Cross-user thread access attempt
- **WHEN** an authenticated user requests runtime operations for a thread owned by a different user
- **THEN** the system rejects the request and does not expose thread metadata, messages, sandbox state, or events

### Requirement: Remove anonymous client ownership contract from runtime APIs
The system MUST NOT use caller-provided anonymous client ownership identifiers as an authorization boundary for chat runtime APIs.

#### Scenario: Runtime request includes legacy client ownership field
- **WHEN** a request includes legacy client ownership parameters
- **THEN** the system ignores or rejects those fields for authorization decisions and uses authenticated user context only

#### Scenario: Runtime request without authenticated context
- **WHEN** a runtime API request is made without a valid authenticated user
- **THEN** the system rejects the request as unauthorized

## MODIFIED Requirements

### Requirement: Enforce idempotent message submission
The system MUST support idempotent user message submission using a user-scoped idempotency key to prevent accidental duplicate turns.

#### Scenario: Duplicate submit with same key by same user and thread
- **WHEN** the same idempotency key is submitted by the same authenticated user for the same thread within retention window
- **THEN** the system returns the original result without creating duplicate messages or runs

#### Scenario: Duplicate key from different user scope
- **WHEN** an idempotency key value matches a key used by a different authenticated user
- **THEN** the system treats it as a distinct scope and does not deduplicate across users
