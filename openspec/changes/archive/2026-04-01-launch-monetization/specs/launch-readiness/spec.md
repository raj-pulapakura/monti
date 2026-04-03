## ADDED Requirements

### Requirement: A billing launch checklist document exists

The system SHALL include a billing launch checklist at `docs/billing/launch-checklist.md` that documents the required staging validation scenarios, the Stripe test-clock scenarios, the ordered flag-enable sequence for production rollout, and the post-launch monitoring gates that must pass before each flag is considered stable.

#### Scenario: Checklist covers the staging subscription lifecycle

- **WHEN** a staging engineer consults the launch checklist before enabling production flags
- **THEN** the checklist provides a step-by-step test matrix for subscription purchase, renewal via test clock, payment failure handling, cancellation, and reactivation

#### Scenario: Checklist covers staging top-up purchase

- **WHEN** a staging engineer validates top-up behavior
- **THEN** the checklist provides steps to purchase a top-up, verify the credit grant is created, and confirm spend works against the top-up bucket after recurring credits are exhausted

#### Scenario: Checklist specifies the production flag-enable sequence

- **WHEN** an operator is ready to enable monetization in production
- **THEN** the checklist specifies the exact order to enable `BILLING_ENABLED`, `FREE_CREDIT_GRANTS_ENABLED`, `STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `TOPUPS_ENABLED`, and `CREDIT_ENFORCEMENT_ENABLED`, along with the verification step required after each flag

#### Scenario: Checklist specifies post-launch monitoring gates

- **WHEN** production flags have been enabled
- **THEN** the checklist specifies the observability checks (structured log events, reconciliation summary endpoint, webhook event table) that must show clean state before the rollout is considered complete
