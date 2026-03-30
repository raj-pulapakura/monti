# experience-refinement Specification

## Purpose
TBD - created by archiving change mvp-generative-learning-loop. Update Purpose after archive.
## Requirements
### Requirement: Refine experience using prior artifact and user intent
The system SHALL execute refinement through `generate_experience` tool invocations that include prior artifact linkage and user refinement intent, returning a full replacement payload with `title`, `description`, `html`, `css`, and `js`.

#### Scenario: Refinement via tool invocation produces updated artifact
- **WHEN** the conversation loop invokes refinement with valid prior artifact reference and user refinement intent
- **THEN** the system returns a complete regenerated payload incorporating the refinement intent

#### Scenario: Missing previous artifact is rejected
- **WHEN** a refinement tool invocation is requested without a resolvable prior artifact reference
- **THEN** the system returns a validation error tool result and does not execute model generation

#### Scenario: Successful refinement persists linked version
- **WHEN** a refinement tool invocation succeeds
- **THEN** the system stores a new version linked to the parent experience lineage and returns a structured success tool result

### Requirement: Preserve continuity context across refinements
The system MUST include original intent context, relevant conversation context, and prior artifact context when constructing refinement prompts.

#### Scenario: Refinement includes conversation and artifact context
- **WHEN** the system builds a refinement generation request from a tool invocation
- **THEN** it includes prior intent context, previous generated artifact context, and relevant thread conversation context as model inputs

### Requirement: Apply same validation and safety rules as generation
The system MUST run refinement responses through the same payload validation and safety enforcement used for initial generation.

#### Scenario: Refinement output violates schema
- **WHEN** a refinement output is malformed or missing required fields
- **THEN** the system rejects the response with a structured validation error

#### Scenario: Refinement output violates safety guard
- **WHEN** a refinement output contains disallowed patterns such as external resource loading attempts
- **THEN** the system rejects the response and returns a safety error

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

