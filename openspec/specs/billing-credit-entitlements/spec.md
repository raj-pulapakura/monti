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

### Requirement: Expose entitlement state for product gating and audit
The system SHALL expose entitlement state that is sufficient for runtime authorization, user-facing balance displays, support inspection, and reconciliation. At minimum, entitlement reads MUST include current plan state, active pricing-rule version, available credits, reserved credits, bucket-level breakdown, and links to the source grants or debits that produced the current state.

#### Scenario: Product UI reads remaining balance
- **WHEN** the web application requests billing status for an authenticated user
- **THEN** the response includes remaining usable credits and enough plan context to explain the current entitlement state

#### Scenario: Support inspects a balance discrepancy
- **WHEN** an operator investigates why a user's visible balance changed
- **THEN** the system can trace the balance back to concrete grants, reservations, releases, and debits rather than an opaque counter mutation

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

