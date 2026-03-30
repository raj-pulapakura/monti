## ADDED Requirements

### Requirement: Persist billing identity and Stripe customer mapping

The system SHALL store at most one billing customer record per authenticated Monti user and SHALL be able to associate that record with a Stripe customer identifier when billing integration is enabled.

#### Scenario: One record per user

- **WHEN** a new billing customer row is created for a given `user_id`
- **THEN** the database prevents a second active row for the same `user_id`

#### Scenario: Stripe customer id is unique when present

- **WHEN** a billing customer row stores a non-null Stripe customer identifier
- **THEN** the database prevents another row from reusing the same Stripe customer identifier

### Requirement: Mirror subscription state for entitlement decisions

The system SHALL persist an internal subscription mirror sufficient to drive paid entitlement state, including a stable Stripe subscription identifier and lifecycle fields needed to interpret paid-through periods and cancellation semantics defined in `billing-payment-lifecycle`.

#### Scenario: Subscription id uniqueness

- **WHEN** a subscription mirror row stores a Stripe subscription identifier
- **THEN** the database enforces uniqueness of that identifier across mirror rows

### Requirement: Record checkout session initiation for audit and support

The system SHALL persist checkout session records for subscription and top-up intents, including a stable Stripe checkout session identifier and the owning Monti user, so funnel debugging and support do not rely on Stripe Dashboard alone.

#### Scenario: Checkout session id uniqueness

- **WHEN** a checkout session record stores a Stripe checkout session identifier
- **THEN** the database enforces uniqueness of that identifier

### Requirement: Store webhook events for idempotent processing

The system SHALL persist received Stripe webhook events in a form that supports idempotent processing, including a unique Stripe event identifier and processing outcome fields sufficient to detect duplicates and retries.

#### Scenario: Duplicate event delivery does not create a second processed row

- **WHEN** the same Stripe event id is inserted twice
- **THEN** the database rejects the second insert or the application uses a single unique constraint to treat the second attempt as a no-op path in later processing

### Requirement: Represent credit grants as durable entitlement sources

The system SHALL persist credit grant records that capture grant source, monetary or cycle context as applicable, bucket classification aligned with `billing-credit-entitlements`, amounts, lifecycle boundaries where relevant, and a reference to the pricing rule snapshot in effect when the grant was created.

#### Scenario: Grant references pricing rule snapshot

- **WHEN** a credit grant row is inserted
- **THEN** it references a `pricing_rule_snapshots` row that identifies the rule version used for interpretation and audit

### Requirement: Support credit reservations without double spend

The system SHALL persist credit reservation rows that can hold credits against concrete grant buckets during in-flight billable work, including status fields that distinguish active, released, and settled reservations.

#### Scenario: Reservation has a stable lifecycle state

- **WHEN** a reservation row exists
- **THEN** its state is represented such that application logic can release or settle exactly one terminal outcome per reservation in a later runtime change

### Requirement: Maintain an append-only credit ledger

The system SHALL persist immutable credit ledger entries that record debits, grants, releases, expirations, and adjustments as distinct entry types, with enough foreign references to correlate entries to reservations, grants, or external payment events.

#### Scenario: Ledger entries are not updated in place for semantic changes

- **WHEN** a correction is required after launch operations mature
- **THEN** new compensating ledger entries are appended rather than mutating or deleting prior ledger rows (except operational fixes outside normal billing semantics)

### Requirement: Version pricing rules for historical attribution

The system SHALL persist pricing rule snapshots that capture the internal launch catalog and future revisions in a way that grants, reservations, and ledger entries can reference for historical explanation.

#### Scenario: Snapshot has a stable version identity

- **WHEN** a pricing rule snapshot is created
- **THEN** it carries a unique version identity suitable for foreign keys from grants and ledger rows

### Requirement: Expose billing configuration and feature flags to the backend

The system SHALL load billing feature flags and launch catalog configuration from environment variables (or equivalent configuration) so later proposals can enable Stripe, grants, enforcement, and portal flows without redeploying for constant changes.

#### Scenario: Flags default to safe off state in development

- **WHEN** billing feature flags are unset in a local environment
- **THEN** the backend treats monetization features as disabled unless explicitly enabled by configuration

## MODIFIED Requirements

_(none)_

## REMOVED Requirements

_(none)_
