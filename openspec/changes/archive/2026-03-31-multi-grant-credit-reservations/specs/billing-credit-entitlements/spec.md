## MODIFIED Requirements

### Requirement: Reserve and settle credits exactly once per billable request

The system MUST create credit reservations before provider execution for each billable generation or refinement request. The system MUST hold reservations against concrete entitlement buckets; when the full cost cannot be covered from a single eligible bucket but the user’s aggregate spendable balance across eligible buckets is sufficient, the system MUST allocate the cost across multiple buckets in deterministic bucket order within one atomic reservation transaction. The system MUST settle all reservation rows for that billable request exactly once only after the billable request succeeds. If the request fails, times out, is cancelled, or is system-deduplicated before a successful persisted artifact is produced, the system MUST release every held reservation slice instead of debiting it. Duplicate reservation attempts for the same billable request identifier MUST NOT double-reserve or double-debit.

#### Scenario: Successful request settles all reservation slices once

- **WHEN** a billable generation request succeeds and produces a persisted artifact
- **THEN** the system converts every active reservation row for that request into settled debits linked to that successful outcome and does not create a second settlement for the same request

#### Scenario: Failed request releases all reservation slices

- **WHEN** a reserved billable request fails before producing a successful persisted artifact
- **THEN** the system releases all held credits back to the underlying entitlement buckets and records no debit for that request

#### Scenario: Automatic retry stays inside one billable reservation

- **WHEN** Monti performs an automatic retry inside a single billable generation request
- **THEN** the system preserves one billable reservation context and settles at most once if the request eventually succeeds

#### Scenario: Splitting cost across buckets when no single bucket covers the full amount

- **WHEN** a billable request’s cost exceeds the spendable balance of any single eligible bucket but does not exceed the user’s total spendable balance across eligible buckets ordered per consumption rules
- **THEN** the system reserves the full cost across multiple buckets in that deterministic order and records no more than one active reservation row per bucket for that request
