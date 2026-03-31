## ADDED Requirements

### Requirement: Align billable credit path with billing feature flags

The system SHALL treat a `generate_experience` request as subject to the credit authorization and settlement requirements in this capability only when both `BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED` are true. When either flag prevents enforcement, the system SHALL NOT apply the insufficient-credit blocking behavior described in **Authorize and reserve credits before provider-backed generation** for that execution.

#### Scenario: Insufficient credits block only under full enforcement

- **WHEN** `BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED` are true and eligible credits are below the cost for the resolved generation mode
- **THEN** the system returns a billing-aware insufficient-credit outcome and does not invoke the provider-backed generation path

#### Scenario: Insufficient credits do not block when enforcement is off

- **WHEN** `BILLING_ENABLED` is true, `CREDIT_ENFORCEMENT_ENABLED` is false, and eligible credits are below the cost for the resolved generation mode
- **THEN** the system does not reject the request solely for insufficient credits

## MODIFIED Requirements

_(none)_

## REMOVED Requirements

_(none)_
