# billing-payment-lifecycle Specification

## ADDED Requirements

### Requirement: Require an authenticated Monti account before chargeable checkout
The system MUST require an authenticated Supabase user before initiating subscription checkout, top-up checkout, or customer-portal access. If a signed-out visitor selects a paid pricing action, the system MUST preserve that billing intent through authentication and resume the intended action afterward.

#### Scenario: Signed-out visitor selects the paid plan
- **WHEN** an unauthenticated visitor chooses the paid pricing CTA from a public pricing surface
- **THEN** the system routes the visitor through sign-in or sign-up with the intended billing action preserved for post-auth resume

#### Scenario: Authenticated user starts a paid checkout
- **WHEN** an authenticated user selects an upgrade action
- **THEN** the system is able to create the appropriate billing session without requiring the user to re-identify themselves to Monti

### Requirement: Maintain a single reusable Stripe customer mapping per user
The system MUST maintain at most one active Stripe customer mapping per Monti user for launch billing flows. Stripe customer creation MUST be lazy on the first billing action that requires it, and subsequent checkout or portal sessions MUST reuse the existing mapping.

#### Scenario: First billing action creates a Stripe customer lazily
- **WHEN** an authenticated user without an existing Stripe customer starts their first billing action
- **THEN** Monti creates a Stripe customer for that user before creating the requested billing session

#### Scenario: Later billing actions reuse the existing customer
- **WHEN** an authenticated user with an existing Stripe customer starts another billing action
- **THEN** Monti reuses the existing customer mapping instead of creating a second Stripe customer

### Requirement: Use separate Stripe flows for subscriptions and top-ups
The system SHALL create Stripe Checkout sessions in subscription mode for paid-plan signup and in one-time payment mode for top-up purchases. Top-up checkout MUST be available only to users whose paid entitlement is still active.

#### Scenario: Paid plan upgrade creates a subscription checkout session
- **WHEN** an eligible authenticated user initiates a paid-plan upgrade
- **THEN** Monti creates a Stripe Checkout session configured for the recurring subscription product

#### Scenario: Eligible paid user initiates a top-up purchase
- **WHEN** an authenticated user with an active paid entitlement chooses to buy additional credits
- **THEN** Monti creates a Stripe Checkout session configured for the launch top-up product

#### Scenario: Lapsed user attempts to buy a top-up
- **WHEN** an authenticated user without an active paid entitlement attempts to purchase a top-up
- **THEN** Monti rejects the request and requires subscription reactivation before top-up purchase

### Requirement: Treat verified Stripe webhooks as authoritative for billing-state mutation
The system MUST mutate internal subscription state, credit grants, and payment-linked entitlements only from verified Stripe webhook events. Client redirects, success pages, cancel pages, and unverified callbacks MUST NOT grant credits or change plan state.

#### Scenario: User reaches a checkout success page before webhook processing
- **WHEN** a user returns from Stripe Checkout but the authoritative webhook has not yet been processed
- **THEN** Monti does not grant credits or mark the subscription as active solely from the redirect

#### Scenario: Verified invoice event grants the paid cycle
- **WHEN** Monti processes a verified successful invoice collection event for an active subscription cycle
- **THEN** the system updates subscription state and creates the corresponding recurring paid credit grant

#### Scenario: Duplicate webhook delivery does not duplicate entitlements
- **WHEN** Stripe retries delivery of the same webhook event
- **THEN** Monti handles the replay idempotently and does not create duplicate subscription changes or credit grants

### Requirement: Map Stripe subscription lifecycle into Monti entitlement state
The system MUST align Monti's paid entitlement lifecycle with verified Stripe billing events. At launch, the free plan acts as the onboarding allowance and there is no separate Stripe trial. Initial paid-cycle access and subsequent monthly paid grants MUST begin only after verified successful collection. Cancellation MUST preserve the user's paid entitlement until the Stripe paid-through period ends, after which recurring paid grants stop and top-up buckets become frozen until reactivation.

#### Scenario: Initial subscription payment activates the paid cycle
- **WHEN** Monti receives the first verified successful payment event for a new subscription
- **THEN** the user becomes paid, receives the paid recurring grant for that billing period, and becomes eligible for top-up checkout

#### Scenario: Subscription cancellation preserves access until period end
- **WHEN** a paid user cancels their subscription while the Stripe paid-through period is still in the future
- **THEN** Monti keeps the paid entitlement active until the period end and does not remove already-granted paid-cycle access immediately

#### Scenario: Paid entitlement lapses after the paid-through period
- **WHEN** the Stripe paid-through period ends without successful renewal
- **THEN** Monti ends the paid entitlement, stops recurring paid grants, and freezes any remaining top-up buckets until the user reactivates

### Requirement: Provide self-service billing management through Stripe Customer Portal
The system SHALL provide authenticated users with a way to open a Stripe Customer Portal session for subscription management, payment-method updates, invoice access, and cancellation. Users without an active Stripe billing relationship MUST be routed to the relevant upgrade path instead of a broken portal flow.

#### Scenario: Paid user opens the customer portal
- **WHEN** an authenticated paid user chooses to manage billing
- **THEN** Monti creates a Stripe Customer Portal session tied to the user's existing Stripe customer

#### Scenario: Free-only user requests billing management
- **WHEN** an authenticated user without a Stripe billing relationship chooses a billing-management action
- **THEN** Monti redirects the user to an upgrade or pricing path rather than creating an invalid portal session
