## ADDED Requirements

### Requirement: Reconciliation view joins credit debits to model token cost

The system SHALL provide a `billing_reconciliation_summary` Postgres view that aggregates `credit_ledger_entries` rows with `entry_type = 'debit_settled'` alongside token usage from `generation_runs` and `experience_versions`, grouped by calendar month and quality tier. The view SHALL use `COALESCE` to zero-out null token columns so pre-telemetry rows do not break aggregation.

#### Scenario: View aggregates debits by month and tier

- **WHEN** `billing_reconciliation_summary` is queried and debit entries exist across multiple months and tiers
- **THEN** the view returns one row per month/tier combination with total credits debited, total tokens consumed, and estimated model cost

#### Scenario: View returns empty for no debit data

- **WHEN** `billing_reconciliation_summary` is queried and no `debit_settled` ledger entries exist
- **THEN** the view returns zero rows without error

#### Scenario: Null token columns do not break aggregation

- **WHEN** some joined `generation_runs` or `experience_versions` rows have null token columns
- **THEN** the view treats those nulls as zero and continues aggregating correctly
