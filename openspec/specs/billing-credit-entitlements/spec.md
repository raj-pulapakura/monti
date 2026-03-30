# billing-credit-entitlements Specification

## Purpose
TBD - created by archiving change define-monetization-contract. Update Purpose after archive.
## Requirements
### Requirement: Define a versioned launch pricing catalog
The system SHALL define a versioned internal pricing catalog for Monti monetization. At launch, the current catalog MUST include a free monthly grant of `15 credits`, a paid monthly grant of `150 credits`, a paid plan price anchor of `$10/month`, a `fast` run cost of `1 credit`, a `quality` run cost of `5 credits`, a top-up pack of `50 credits for $4`, and no automatic overage billing.

#### Scenario: Runtime resolves the launch cost schedule
- **WHEN** the billing domain resolves the current pricing contract for a billable generation request
- **THEN** it returns the active pricing-rule version and the launch credit costs defined for `fast`, `quality`, recurring grants, and top-ups

#### Scenario: Historical activity remains tied to the rule version in effect
- **WHEN** a later pricing revision is introduced after launch
- **THEN** prior grants, reservations, debits, and billing displays remain attributable to the pricing-rule version that was active when each record was created

### Requirement: Store credits in explicit entitlement buckets
The system MUST represent credits as explicit entitlement buckets rather than a single undifferentiated balance. Each usable bucket MUST record its source, granted amount, remaining amount, reserved amount, lifecycle state, pricing-rule version, and expiration behavior. Recurring buckets MUST expire at cycle end, and top-up buckets MUST remain available only while the user has an active paid entitlement.

#### Scenario: Free cycle grant creates a recurring bucket
- **WHEN** a user becomes eligible for the launch free plan
- **THEN** the system creates a free recurring credit bucket with a monthly expiry boundary and the corresponding pricing-rule version

#### Scenario: Paid invoice grant creates a paid recurring bucket
- **WHEN** Monti receives a verified successful paid subscription cycle event
- **THEN** the system creates a paid recurring credit bucket for that billing period rather than mutating an opaque scalar balance

#### Scenario: Top-up purchase creates a top-up bucket
- **WHEN** Monti receives a verified successful top-up payment event for an eligible paid user
- **THEN** the system creates a distinct top-up bucket that can be tracked independently from recurring-cycle grants

### Requirement: Consume eligible credits deterministically
The system MUST authorize and consume credits from eligible buckets in a deterministic order. Eligible recurring buckets MUST be ordered by earliest expiration timestamp first, and eligible top-up buckets MUST be ordered after recurring buckets by oldest grant first. Top-up buckets MUST be ineligible for spend while the user lacks an active paid entitlement.

#### Scenario: Overlapping recurring buckets use the earliest-expiring bucket first
- **WHEN** a user has more than one active recurring bucket, such as a remaining free-cycle bucket and a newer paid-cycle bucket
- **THEN** the system spends from the recurring bucket with the earliest expiration timestamp before touching later-expiring recurring buckets

#### Scenario: Monthly included credits are spent before top-ups
- **WHEN** a paid user has both an active paid recurring bucket and an available top-up bucket
- **THEN** the system consumes the recurring bucket before consuming any top-up credits

#### Scenario: Lapsed paid state freezes top-up availability
- **WHEN** a user's paid entitlement fully lapses after the Stripe paid-through period ends
- **THEN** the system excludes top-up buckets from spend authorization until the user reactivates a paid subscription

### Requirement: Reserve and settle credits exactly once per billable request
The system MUST create a credit reservation before provider execution for each billable generation or refinement request, hold that reservation against concrete entitlement buckets, and settle it into a debit exactly once only after the billable request succeeds. If the request fails, times out, is cancelled, or is system-deduplicated before a successful persisted artifact is produced, the system MUST release the reservation instead of debiting it.

#### Scenario: Successful request settles a reservation once
- **WHEN** a billable generation request succeeds and produces a persisted artifact
- **THEN** the system converts the existing reservation into one debit linked to that successful outcome and does not create a second debit for the same request

#### Scenario: Failed request releases the reservation
- **WHEN** a reserved billable request fails before producing a successful persisted artifact
- **THEN** the system releases the held credits back to the underlying entitlement buckets and records no debit

#### Scenario: Automatic retry stays inside one billable reservation
- **WHEN** Monti performs an automatic retry inside a single billable generation request
- **THEN** the system preserves one billable reservation context and settles at most one debit if the request eventually succeeds

### Requirement: Expose entitlement state for product gating and audit
The system SHALL expose entitlement state that is sufficient for runtime authorization, user-facing balance displays, support inspection, and reconciliation. At minimum, entitlement reads MUST include current plan state, active pricing-rule version, available credits, reserved credits, bucket-level breakdown, and links to the source grants or debits that produced the current state.

#### Scenario: Product UI reads remaining balance
- **WHEN** the web application requests billing status for an authenticated user
- **THEN** the response includes remaining usable credits and enough plan context to explain the current entitlement state

#### Scenario: Support inspects a balance discrepancy
- **WHEN** an operator investigates why a user's visible balance changed
- **THEN** the system can trace the balance back to concrete grants, reservations, releases, and debits rather than an opaque counter mutation
