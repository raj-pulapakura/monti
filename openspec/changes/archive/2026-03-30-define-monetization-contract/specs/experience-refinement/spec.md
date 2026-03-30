# experience-refinement Specification

## ADDED Requirements

### Requirement: Authorize and reserve credits before provider-backed refinement
The system MUST resolve the selected refinement mode's credit cost from the active pricing contract, confirm the authenticated user has sufficient eligible credits, and create a reservation before calling any provider-backed refinement path for a billable refinement request.

#### Scenario: Sufficient balance creates a refinement reservation
- **WHEN** a billable refinement request resolves to a mode whose credit cost is fully covered by eligible entitlement buckets
- **THEN** the system creates a reservation for that cost before invoking the provider-backed refinement flow

#### Scenario: Insufficient balance blocks refinement before provider execution
- **WHEN** a billable refinement request resolves to a mode whose credit cost is not fully covered by eligible entitlement buckets
- **THEN** the system rejects the request with a billing-aware insufficient-credit outcome and does not call the provider-backed refinement path

### Requirement: Settle refinement credits only on successful persisted linked-version outcomes
The system MUST settle reserved refinement credits into a debit only after a successful refinement result is persisted as a new linked experience version. Validation failures, missing-parent validation errors, safety failures, provider errors, user cancellations, and system-deduplicated replays MUST NOT create a debit for the failed or non-final outcome.

#### Scenario: Successful refinement settles one debit
- **WHEN** a refinement request succeeds and the resulting linked artifact version is persisted
- **THEN** the system settles the existing reservation into exactly one debit linked to that persisted refinement outcome

#### Scenario: Failed refinement releases the reservation
- **WHEN** a refinement request fails after credits were reserved but before a new linked experience version is persisted
- **THEN** the system releases the reservation and records no debit for that failed request

#### Scenario: Validation rejection does not consume credits
- **WHEN** a refinement request is rejected because the prior artifact reference or refined payload is invalid
- **THEN** the system records no debit for the rejected refinement request
