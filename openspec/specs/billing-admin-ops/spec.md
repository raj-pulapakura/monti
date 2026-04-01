# billing-admin-ops Specification

## Purpose

Operational admin controls for billing support workflows, including manual credit grants/reversals, ledger inspection, webhook replay, and reconciliation queries protected by a shared admin secret.

## Requirements

### Requirement: Admin requests are authenticated via shared secret

The system SHALL reject all admin endpoint requests that do not present a valid `X-Admin-Secret` header matching the `ADMIN_SECRET` environment variable. The system SHALL return 401 for a missing or incorrect secret.

#### Scenario: Missing admin secret is rejected

- **WHEN** a request reaches any `/api/admin/*` endpoint without an `X-Admin-Secret` header
- **THEN** the system returns HTTP 401

#### Scenario: Incorrect admin secret is rejected

- **WHEN** a request reaches any `/api/admin/*` endpoint with an `X-Admin-Secret` value that does not match `ADMIN_SECRET`
- **THEN** the system returns HTTP 401

#### Scenario: Correct admin secret is accepted

- **WHEN** a request reaches any `/api/admin/*` endpoint with the correct `X-Admin-Secret` value
- **THEN** the request proceeds to the handler

### Requirement: Admin can issue a manual credit grant to a user

The system SHALL allow an admin to add credits to a user's balance by specifying a user ID, credit amount, reason, and optional operator note. The system SHALL create a `manual` source credit grant and a corresponding `manual_grant` ledger entry.

#### Scenario: Successful manual grant

- **WHEN** an admin posts a valid manual grant request for an existing user with a positive credit amount
- **THEN** the system creates a credit grant with `source = 'manual'` and `bucket_kind = 'manual'`
- **AND** the system inserts a `credit_ledger_entries` row with `entry_type = 'manual_grant'` and the correct `credits_delta`
- **AND** the system returns the created grant ID and new available credit totals

#### Scenario: Manual grant for unknown user is rejected

- **WHEN** an admin posts a manual grant request for a user ID that has no billing customer record
- **THEN** the system returns an error indicating the user was not found

#### Scenario: Manual grant with zero or negative credits is rejected

- **WHEN** an admin posts a manual grant request with `credits <= 0`
- **THEN** the system returns a validation error

### Requirement: Admin can issue a manual credit reversal for a user

The system SHALL allow an admin to deduct credits from a user's available balance by specifying a user ID, credit amount, reason, and optional operator note. The system SHALL insert a `manual_adjustment` ledger entry with a negative `credits_delta` and SHALL deduct from the most-spendable available grant. The system SHALL reject reversals that would reduce any targeted grant's remaining credits below zero.

#### Scenario: Successful manual reversal

- **WHEN** an admin posts a valid reversal request and the user has sufficient available credits
- **THEN** the system inserts a `credit_ledger_entries` row with `entry_type = 'manual_adjustment'` and a negative `credits_delta`
- **AND** the affected grant's `remaining_credits` is reduced by the reversal amount
- **AND** the system returns the updated available credit totals

#### Scenario: Reversal that would go below zero is rejected

- **WHEN** an admin posts a reversal request for more credits than the user has available
- **THEN** the system returns an error indicating insufficient credits for reversal

### Requirement: Admin can list recent ledger entries for a user

The system SHALL allow an admin to retrieve recent `credit_ledger_entries` rows for a given user ID, ordered by most recent first, with a configurable limit.

#### Scenario: Ledger entries returned in reverse chronological order

- **WHEN** an admin requests ledger entries for a user with multiple entries
- **THEN** the system returns entries ordered by `created_at` descending

#### Scenario: Empty ledger for new user

- **WHEN** an admin requests ledger entries for a user with no ledger history
- **THEN** the system returns an empty list without error

### Requirement: Admin can replay a failed webhook event

The system SHALL allow an admin to re-drive a `billing_webhook_events` row through the webhook processing pipeline by its internal row ID. The system SHALL reset the row's `processing_status` to `pending` before replaying. The existing idempotency logic in the webhook processor SHALL prevent double-grants if the event was previously processed successfully.

#### Scenario: Replay of a failed event re-processes it

- **WHEN** an admin replays a webhook event row with `processing_status = 'failed'`
- **THEN** the system resets the row status to `pending` and re-runs the handler
- **AND** if the handler succeeds, the row reaches `processing_status = 'processed'`

#### Scenario: Replay of an already-processed event is safe

- **WHEN** an admin replays a webhook event row with `processing_status = 'processed'`
- **THEN** the webhook processor's idempotency logic returns `'duplicate'`
- **AND** no duplicate grants or state mutations occur

#### Scenario: Replay of an unknown event ID returns not found

- **WHEN** an admin requests replay of a webhook event ID that does not exist
- **THEN** the system returns HTTP 404

### Requirement: Admin can query billing reconciliation summary

The system SHALL expose a read-only reconciliation summary to admin callers that joins credit debits to actual model token cost, grouped by calendar month and quality tier. The summary SHALL use `COALESCE` to zero-out null token values from pre-telemetry runs and SHALL exclude those rows from cost estimates.

#### Scenario: Reconciliation summary returns monthly grouped rows

- **WHEN** an admin requests the reconciliation summary and debits exist across multiple months
- **THEN** the system returns one row per month/tier combination with aggregated credits consumed, tokens consumed, and estimated model cost

#### Scenario: Reconciliation summary returns empty for no data

- **WHEN** an admin requests the reconciliation summary and no debit ledger entries exist
- **THEN** the system returns an empty list without error
