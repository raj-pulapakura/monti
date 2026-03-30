# experience-generation Specification

## ADDED Requirements

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
