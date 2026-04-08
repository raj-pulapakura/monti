## MODIFIED Requirements

### Requirement: Provide thread hydration API for frontend bootstrap
The system SHALL provide a hydration response that includes thread metadata, ordered messages, current sandbox state, and active runtime metadata for both conversation-loop and generation-engine progression. The active experience payload in the hydration response SHALL include `isFavourite` reflecting the current `experiences.is_favourite` value.

#### Scenario: Hydrate populated thread with active tool execution
- **WHEN** the client requests hydration for a thread where a conversation run has an in-flight `generate_experience` invocation
- **THEN** the system returns message history, sandbox state, conversation run metadata, generation-execution metadata, and `isFavourite` on the active experience needed for reducer reconciliation

#### Scenario: Hydrate thread with conversation-only execution
- **WHEN** the client requests hydration for a thread where the latest run completed without tool usage
- **THEN** the system returns the persisted assistant message timeline, terminal conversation run status, and `isFavourite` on the active experience without generation invocation state

## ADDED Requirements

### Requirement: Expose isFavourite in thread list response
The thread list response SHALL include `isFavourite` for each thread card, sourced from `experiences.is_favourite` for the thread's associated experience. Threads with no associated experience SHALL return `isFavourite: false`.

#### Scenario: Thread list includes favourite state
- **WHEN** an authenticated user requests their thread list
- **THEN** each thread card in the response includes `isFavourite` reflecting the current `experiences.is_favourite` value

#### Scenario: Thread with no experience returns isFavourite false
- **WHEN** a thread card has no associated experience
- **THEN** `isFavourite` is `false` in the response

### Requirement: Toggle experience favourite via thread context
The system SHALL accept `PATCH /api/chat/threads/:threadId/favourite` with body `{ "isFavourite": boolean }`, resolve the experience from the thread's sandbox state, and persist the value to `experiences.is_favourite`. See the `experience-favouriting` spec for full contract.

#### Scenario: Favourite toggle succeeds
- **WHEN** an authenticated user sends a valid PATCH favourite request
- **THEN** the system persists the new value and returns `{ ok: true, data: { isFavourite: <value> } }`
