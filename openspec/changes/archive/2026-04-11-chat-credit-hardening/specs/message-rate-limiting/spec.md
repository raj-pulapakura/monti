## ADDED Requirements

### Requirement: Throttle message submission per authenticated user
The system SHALL enforce a per-user rate limit on `POST /api/chat/threads/:threadId/messages`. The throttle key SHALL be the authenticated user's ID. When the limit is exceeded the system SHALL return HTTP 429. The limit SHALL be configurable via the `CHAT_RATE_LIMIT_PER_MINUTE` environment variable and SHALL default to 30 requests per minute. Rate limiting SHALL apply regardless of the state of `BILLING_ENABLED` or `CREDIT_ENFORCEMENT_ENABLED`.

#### Scenario: User submits within the rate limit
- **WHEN** an authenticated user submits messages at or below the configured rate limit
- **THEN** all requests are accepted normally with no throttle-related response

#### Scenario: User exceeds the rate limit
- **WHEN** an authenticated user submits more messages than the configured per-minute limit
- **THEN** the system returns HTTP 429 and the response includes a `Retry-After` header indicating when the user may retry

#### Scenario: Rate limit is configurable
- **WHEN** `CHAT_RATE_LIMIT_PER_MINUTE` is set to a valid positive integer in the environment
- **THEN** the system enforces that value as the per-user per-minute limit instead of the default of 30

#### Scenario: Different users do not share a rate limit bucket
- **WHEN** two different authenticated users each submit messages at or below the rate limit
- **THEN** neither user is throttled due to the other's activity
