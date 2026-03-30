# experience-generation Specification

## Purpose
TBD - created by archiving change mvp-generative-learning-loop. Update Purpose after archive.
## Requirements
### Requirement: Generate interactive learning experience from prompt
The system SHALL accept generation intent from `generate_experience` tool arguments and relevant conversation context, return a structured payload with non-empty `title`, `description`, `html`, `css`, and `js`, and persist the successful result as a versioned artifact.

#### Scenario: Successful generation from tool invocation
- **WHEN** the conversation loop invokes `generate_experience` with prompt intent and optional selectors
- **THEN** the generation engine returns a successful payload containing `title`, `description`, `html`, `css`, and `js`

#### Scenario: Successful generation persists artifact
- **WHEN** generation completes successfully in the tool executor path
- **THEN** the system stores the generated artifact and generation metadata in persistence storage and returns a structured success tool result

### Requirement: Enforce structured output validation
The system MUST validate generated output shape and reject responses that are not valid structured payloads.

#### Scenario: Invalid model payload is rejected
- **WHEN** model output is missing one of `html`, `css`, or `js`
- **THEN** the system marks the tool invocation as failed and does not return partial executable output to the sandbox

#### Scenario: Oversized generated part is rejected
- **WHEN** generated `html`, `css`, or `js` exceeds configured size limits
- **THEN** the system marks the tool invocation as failed and returns validation error metadata

### Requirement: Normalize provider failures for clients
The system MUST map provider-specific generation failures into a consistent tool result error format consumable by conversation orchestration, API responses, and event streams.

#### Scenario: Upstream provider timeout
- **WHEN** the selected provider times out during generation tool execution
- **THEN** the tool executor returns normalized timeout metadata and avoids partial executable payload fields

#### Scenario: Upstream provider refusal
- **WHEN** the selected provider refuses the generation request
- **THEN** the tool executor returns normalized refusal metadata and avoids partial executable payload fields

### Requirement: Authorize and reserve credits before provider-backed generation
The system MUST resolve the selected generation mode's credit cost from the active pricing contract, confirm the authenticated user has sufficient eligible credits, and create a reservation before calling any provider-backed generation path for a billable `generate_experience` request.

#### Scenario: Sufficient balance creates a generation reservation
- **WHEN** a billable generation request resolves to a mode whose credit cost is fully covered by eligible entitlement buckets
- **THEN** the system creates a reservation for that cost before invoking the provider-backed generation flow

#### Scenario: Insufficient balance blocks generation before provider execution
- **WHEN** a billable generation request resolves to a mode whose credit cost is not fully covered by eligible entitlement buckets
- **THEN** the system rejects the request with a billing-aware insufficient-credit outcome and does not call the provider-backed generation path

### Requirement: Settle generation credits only on successful persisted artifact outcomes
The system MUST settle reserved generation credits into a debit only after a successful generation result is persisted as a new experience version. Timeouts, validation failures, safety failures, provider errors, user cancellations, and system-deduplicated replays MUST NOT create a debit for the failed or non-final outcome.

#### Scenario: Successful generation settles one debit
- **WHEN** a generation request succeeds and the resulting artifact is persisted as a new experience version
- **THEN** the system settles the existing reservation into exactly one debit linked to that persisted outcome

#### Scenario: Failed generation releases the reservation
- **WHEN** a generation request fails after credits were reserved but before a new experience version is persisted
- **THEN** the system releases the reservation and records no debit for that failed request

#### Scenario: Deduplicated replay does not create a second debit
- **WHEN** Monti suppresses a system-deduplicated replay of a prior successful generation request
- **THEN** the system does not create a second debit for the replayed request

