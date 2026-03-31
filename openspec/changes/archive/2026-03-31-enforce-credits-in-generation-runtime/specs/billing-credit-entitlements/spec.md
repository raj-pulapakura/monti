## ADDED Requirements

### Requirement: Gate hard credit enforcement with billing and enforcement flags

The system SHALL apply reserve-and-settle logic to billable `generate_experience` executions only when `BILLING_ENABLED` is true and `CREDIT_ENFORCEMENT_ENABLED` is true. When `BILLING_ENABLED` is false, the system SHALL NOT create reservations, modify grant balances for runtime enforcement, or append enforcement-related ledger rows for that execution. When `BILLING_ENABLED` is true and `CREDIT_ENFORCEMENT_ENABLED` is false, the system SHALL NOT block generation for insufficient credits for that execution (observation-only or no-op for enforcement writes unless explicitly specified elsewhere).

#### Scenario: Billing disabled skips enforcement writes

- **WHEN** `BILLING_ENABLED` is false and a `generate_experience` tool execution runs
- **THEN** the system does not create a `credit_reservations` row or change `reserved_credits` / `remaining_credits` for credit enforcement on that execution

#### Scenario: Enforcement disabled allows generation without a hard balance gate

- **WHEN** `BILLING_ENABLED` is true, `CREDIT_ENFORCEMENT_ENABLED` is false, and the user has zero eligible credits
- **THEN** the system still allows the provider-backed generation path to run for that execution (subject to other product rules)

### Requirement: Anchor each billable reservation to a tool invocation

The system SHALL treat one persisted `generate_experience` **tool invocation** as the primary billable unit for reservation idempotency: at most one **active** `credit_reservations` row SHALL exist per `tool_invocation_id` used for enforcement. The system SHALL record that `tool_invocation_id` on the reservation row when the invocation record exists at reserve time.

#### Scenario: Concurrent duplicate reserve attempts for the same invocation

- **WHEN** two concurrent enforcement paths attempt to reserve credits for the same `tool_invocation_id`
- **THEN** at most one active reservation is created and the other attempt fails or no-ops in a safe, deterministic way without double-reserving credits

### Requirement: Persist ledger rows for reservation lifecycle when enforcement runs

When enforcement creates, releases, or settles a reservation, the system SHALL append the corresponding `credit_ledger_entries` rows (`reservation_created`, `reservation_released`, `debit_settled` as applicable) with references to the reservation and affected grants where schema columns allow, so support can reconcile grant state to ledger history.

#### Scenario: Successful settle produces a debit ledger row

- **WHEN** a reservation is settled after a successful persisted artifact outcome under enforcement
- **THEN** the system records a `debit_settled` ledger entry linked to that reservation (and grant references as allowed by the schema)

## MODIFIED Requirements

_(none)_

## REMOVED Requirements

_(none)_
