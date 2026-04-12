## ADDED Requirements

### Requirement: Archive thread via DELETE endpoint
The system SHALL expose `DELETE /api/chat/threads/:threadId` that sets `archived_at = now()` on the target thread after asserting user ownership. See the `session-deletion` spec for the full contract.

#### Scenario: Thread soft-deleted
- **WHEN** an authenticated owner calls `DELETE /api/chat/threads/:threadId`
- **THEN** `archived_at` is set and the thread no longer appears in list responses
