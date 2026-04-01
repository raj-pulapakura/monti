# billing-observability Specification

## Purpose

Structured billing telemetry for checkout, portal, reservation, debit settlement, manual admin actions, and webhook replay, plus operational runbook documentation for support and reconciliation workflows.

## Requirements

### Requirement: Billing checkout and portal events are logged

The system SHALL emit a structured log event when a Stripe Checkout session is created for a subscription or top-up, and when a Customer Portal session is created. Each log event SHALL include the billing action type and the authenticated user ID.

#### Scenario: Subscription checkout session created

- **WHEN** a subscription Checkout session is successfully created via `POST /api/billing/checkout/subscription`
- **THEN** the system emits a structured log with event key `billing.checkout_session_created`, the user ID, and `type = 'subscription'`

#### Scenario: Top-up checkout session created

- **WHEN** a top-up Checkout session is successfully created via `POST /api/billing/checkout/topup`
- **THEN** the system emits a structured log with event key `billing.checkout_session_created`, the user ID, and `type = 'topup'`

#### Scenario: Portal session created

- **WHEN** a Customer Portal session is successfully created via `POST /api/billing/portal`
- **THEN** the system emits a structured log with event key `billing.portal_session_created` and the user ID

### Requirement: Credit reservation lifecycle events are logged

The system SHALL emit structured log events when a credit reservation is created, when a reservation is released, and when a balance-insufficient condition prevents reservation.

#### Scenario: Reservation created

- **WHEN** credits are successfully reserved for a tool invocation
- **THEN** the system emits a structured log with event key `billing.reservation_created`, the user ID, tool invocation ID, quality tier, and credits reserved

#### Scenario: Reservation released

- **WHEN** a reservation is released due to generation failure, cancellation, timeout, or deduplication
- **THEN** the system emits a structured log with event key `billing.reservation_released`, the user ID, tool invocation ID, and the release reason

#### Scenario: Balance insufficient

- **WHEN** a reservation attempt fails due to insufficient credits
- **THEN** the system emits a structured log with event key `billing.balance_insufficient`, the user ID, quality tier, credits required, and credits available

### Requirement: Debit settlement events are logged

The system SHALL emit a structured log event when credits are successfully debited following a confirmed artifact outcome.

#### Scenario: Debit settled

- **WHEN** a credit debit is settled against a successful generation outcome
- **THEN** the system emits a structured log with event key `billing.debit_settled`, the user ID, tool invocation ID, experience version ID, and credits debited

### Requirement: Manual credit operation events are logged

The system SHALL emit structured log events when an admin issues a manual credit grant or manual credit reversal, including the operator note when provided.

#### Scenario: Manual grant logged

- **WHEN** an admin issues a manual credit grant
- **THEN** the system emits a structured log with event key `billing.manual_grant`, the target user ID, credits granted, reason, and operator note

#### Scenario: Manual reversal logged

- **WHEN** an admin issues a manual credit reversal
- **THEN** the system emits a structured log with event key `billing.manual_reversal`, the target user ID, credits reversed, reason, and operator note

### Requirement: Webhook replay events are logged

The system SHALL emit a structured log event when an admin triggers a webhook replay, including the outcome.

#### Scenario: Webhook replay logged

- **WHEN** an admin triggers a webhook replay
- **THEN** the system emits a structured log with event key `billing.webhook_replayed`, the internal event row ID, the Stripe event ID, and the outcome (`processed` or `duplicate`)

### Requirement: Billing operations runbook is documented

The system SHALL include a billing operations runbook at `docs/billing/runbook.md` that documents every admin operation with exact curl command examples, expected HTTP responses, and recovery procedures for common failure scenarios.

#### Scenario: Runbook covers webhook replay

- **WHEN** a webhook event has `processing_status = 'failed'` in the database
- **THEN** the runbook provides the exact curl command to identify the event row and replay it

#### Scenario: Runbook covers manual credit grant

- **WHEN** a support operator needs to issue a goodwill credit grant to a user
- **THEN** the runbook provides the exact curl command with required fields and expected response shape

#### Scenario: Runbook covers manual credit reversal

- **WHEN** a support operator needs to correct a billing mistake by reversing credits
- **THEN** the runbook provides the exact curl command with required fields, expected response shape, and a note on the zero-floor guard

#### Scenario: Runbook covers reconciliation query

- **WHEN** a stakeholder needs to compare credits consumed against model cost for a given month
- **THEN** the runbook provides the exact curl command for the reconciliation summary endpoint and explains how to interpret the response
