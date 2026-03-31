## ADDED Requirements

### Requirement: Issue free monthly grants on a UTC calendar-month cycle

The system SHALL ensure each eligible free-plan user receives exactly one `recurring_free` credit grant per UTC calendar month, bounded by `cycle_start` at the first instant of the month in UTC and `cycle_end` at the first instant of the following UTC month. Grant creation MUST be idempotent for the same user and month.

#### Scenario: First visit in a month creates the grant

- **WHEN** an eligible free user’s entitlements are resolved for the first time in a UTC month and no grant exists for that user and month boundary
- **THEN** the system creates a `credit_grants` row with `bucket_kind` `recurring_free`, correct `cycle_start` and `cycle_end`, credits equal to the active pricing rule’s free monthly allowance, and links the active `pricing_rule_snapshot`

#### Scenario: Concurrent requests do not duplicate the grant

- **WHEN** two concurrent entitlement resolutions run for the same user and UTC month
- **THEN** at most one grant row exists for that user and month boundary

### Requirement: Record free monthly grants on the append-only ledger

The system SHALL insert a `credit_ledger_entries` row with entry type `free_monthly_grant` when a free monthly grant row is first created, carrying a positive `credits_delta` matching the grant and referencing the grant and pricing snapshot where columns allow.

#### Scenario: Ledger mirrors new free grant

- **WHEN** the system creates a new free monthly `credit_grants` row
- **THEN** the same transaction includes a `credit_ledger_entries` row of type `free_monthly_grant` for that user with matching credit amount and references for audit

### Requirement: Expose authenticated billing summary via HTTP

The system SHALL provide `GET /api/billing/me` for authenticated users, returning a structured snapshot that includes whether billing features are enabled, effective plan tier (`free` or `paid`), active pricing-rule version key, per-tier generation costs, total included and top-up spendable credits consistent with bucket rules, total reserved credits, a bucket-level breakdown sufficient for UI and support, the next UTC monthly refresh instant for free included credits, and subscription period end when available from `billing_subscriptions`.

#### Scenario: Free user receives costs and balances

- **WHEN** an authenticated free user calls `GET /api/billing/me` with billing features enabled
- **THEN** the response includes `free` plan context, fast and quality credit costs from the active pricing rule, non-negative included and top-up availability figures consistent with frozen top-up rules, and `nextIncludedRefreshAt` aligned to the UTC month boundary

#### Scenario: Billing disabled yields a safe payload

- **WHEN** `BILLING_ENABLED` is false
- **THEN** the endpoint returns success with `billingEnabled` false and without exposing misleading paid balances

### Requirement: Derive spendable bucket balances from grant and reservation columns

The system SHALL compute per-bucket spendable credits as `max(remaining_credits - reserved_credits, 0)` on each eligible `credit_grants` row until runtime reservation wiring changes the invariant, and SHALL aggregate totals accordingly for entitlement reads.

#### Scenario: Reserved amount reduces displayed availability

- **WHEN** a grant row has `remaining_credits` greater than `reserved_credits`
- **THEN** the entitlement read counts only the difference toward spendable balance for that bucket

## MODIFIED Requirements

_(none)_

## REMOVED Requirements

_(none)_
