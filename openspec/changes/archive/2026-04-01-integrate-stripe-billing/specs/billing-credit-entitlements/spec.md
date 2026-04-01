## ADDED Requirements

### Requirement: Correlate Stripe-issued grants and grant ledger rows to Stripe identifiers

When the system creates a paid recurring credit grant as a result of verified Stripe webhooks, it SHALL use `credit_grants.source` `paid_cycle` and `bucket_kind` `recurring_paid` (per `public.credit_grants` check constraints). When it creates a top-up grant, it SHALL use `source` `topup` and `bucket_kind` `topup`. In both cases it SHALL populate `stripe_invoice_id` and/or `stripe_checkout_session_id` on `credit_grants` when those identifiers are available from the event payload, and SHALL append `credit_ledger_entries` of type `paid_monthly_grant` or `topup_grant` with `stripe_event_id` set to the Stripe event `id` when persisting that column.

#### Scenario: Paid monthly grant ledger references Stripe event

- **WHEN** a verified `invoice.paid` (or equivalent agreed processing path) creates a new paid recurring grant for a subscription period
- **THEN** the system inserts a `credit_ledger_entries` row of type `paid_monthly_grant` with a positive `credits_delta`, references the new or updated grant, and records the Stripe `event.id` in `stripe_event_id`

#### Scenario: Top-up grant ledger references Stripe event

- **WHEN** a verified successful top-up payment creates a top-up grant
- **THEN** the system inserts a `credit_ledger_entries` row of type `topup_grant` with a positive `credits_delta`, references the grant, and records the Stripe `event.id` in `stripe_event_id`

### Requirement: Enforce idempotent paid and top-up grant creation per Stripe invoice or session

The system MUST NOT create a second paid recurring grant for the same subscription billing period nor a second top-up grant for the same successful top-up payment when webhooks are retried or multiple related events arrive. The system SHALL use unique constraints and/or deterministic lookups on `stripe_invoice_id`, `stripe_checkout_session_id`, and existing grant rows to enforce this invariant.

#### Scenario: Retry of the same invoice-paid grant path

- **WHEN** webhook processing runs twice for the same logical paid cycle (same `stripe_invoice_id` or agreed unique key)
- **THEN** at most one paid recurring grant and one matching `paid_monthly_grant` ledger row exist for that cycle

#### Scenario: Retry of the same top-up payment

- **WHEN** webhook processing runs twice for the same top-up checkout or payment intent outcome (same `stripe_checkout_session_id` or agreed unique key)
- **THEN** at most one top-up grant and one matching `topup_grant` ledger row exist for that purchase
