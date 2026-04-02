# billing-payment-lifecycle Specification

## Purpose
TBD - created by archiving change define-monetization-contract. Update Purpose after archive.
## Requirements
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

When processing `invoice.paid`, if the `billing_customers` row for the invoice's Stripe customer does not yet exist or has no `stripe_customer_id` mapping, the system MUST resolve the Monti user from the subscription's `metadata.monti_user_id` field and repair the customer mapping before completing grant creation. The system MUST NOT silently drop the event when user resolution via customer mapping fails but subscription metadata is available.

#### Scenario: Initial subscription payment activates the paid cycle
- **WHEN** Monti receives the first verified successful payment event for a new subscription
- **THEN** the user becomes paid, receives the paid recurring grant for that billing period, and becomes eligible for top-up checkout

#### Scenario: Subscription cancellation preserves access until period end
- **WHEN** a paid user cancels their subscription while the Stripe paid-through period is still in the future
- **THEN** Monti keeps the paid entitlement active until the period end and does not remove already-granted paid-cycle access immediately

#### Scenario: Paid entitlement lapses after the paid-through period
- **WHEN** the Stripe paid-through period ends without successful renewal
- **THEN** Monti ends the paid entitlement, stops recurring paid grants, and freezes any remaining top-up buckets until the user reactivates

#### Scenario: invoice.paid arrives before checkout.session.completed
- **WHEN** `invoice.paid` is delivered before `checkout.session.completed` and `billing_customers.stripe_customer_id` is not yet set
- **THEN** the system resolves the Monti user from the subscription's `metadata.monti_user_id`, repairs the customer mapping, and creates the paid recurring grant without error

#### Scenario: checkout.session.completed establishes the customer mapping
- **WHEN** a subscription-mode `checkout.session.completed` event is processed
- **THEN** the system upserts `billing_customers.stripe_customer_id` from the session's customer field so subsequent invoice events can resolve the user via the standard customer-mapping lookup

### Requirement: Provide self-service billing management through Stripe Customer Portal
The system SHALL provide authenticated users with a way to open a Stripe Customer Portal session for subscription management, payment-method updates, invoice access, and cancellation. Users without an active Stripe billing relationship MUST be routed to the relevant upgrade path instead of a broken portal flow.

#### Scenario: Paid user opens the customer portal
- **WHEN** an authenticated paid user chooses to manage billing
- **THEN** Monti creates a Stripe Customer Portal session tied to the user's existing Stripe customer

#### Scenario: Free-only user requests billing management
- **WHEN** an authenticated user without a Stripe billing relationship chooses a billing-management action
- **THEN** Monti redirects the user to an upgrade or pricing path rather than creating an invalid portal session

### Requirement: Expose Stripe Checkout and Portal session endpoints
The system SHALL provide authenticated HTTP endpoints that create Stripe Billing objects and return a client-redirect URL for Stripe-hosted Checkout or the Stripe Customer Portal. The endpoints SHALL be `POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`, and `POST /api/billing/portal`, each requiring a valid Monti user session. Responses SHALL include sufficient information for the client to redirect the browser to Stripe (at minimum the session `url`).

#### Scenario: Authenticated user starts subscription checkout
- **WHEN** an authenticated user posts to `POST /api/billing/checkout/subscription` with `BILLING_ENABLED` true and a configured Stripe subscription price
- **THEN** the system ensures a Stripe customer mapping exists, creates a Stripe Checkout session in subscription mode for the configured paid monthly price, records a `billing_checkout_sessions` row for audit, and returns the Checkout session URL

#### Scenario: Eligible paid user starts top-up checkout
- **WHEN** an authenticated user with an active paid entitlement posts to `POST /api/billing/checkout/topup` and top-ups are enabled
- **THEN** the system creates a Stripe Checkout session in payment mode for the configured top-up price, records a `billing_checkout_sessions` row, and returns the Checkout session URL

#### Scenario: Paid user opens customer portal
- **WHEN** an authenticated user with a Stripe customer mapping posts to `POST /api/billing/portal` and the portal feature flag is enabled
- **THEN** the system creates a Stripe Billing Portal session with a configured return URL and returns the portal URL

### Requirement: Reuse Stripe customer and Checkout patterns that discourage duplicate paid subscriptions
When creating a subscription Checkout session, the system SHALL use the persisted `billing_customers.stripe_customer_id` for that Monti user when present and SHALL follow Stripe's recommended subscription Checkout patterns for launch (single customer per user, no ad-hoc second customer for the same `user_id`) so a user is not pushed into parallel unintended paid subscriptions by default.

#### Scenario: Subscription checkout uses mapped customer id
- **WHEN** an authenticated user with an existing `billing_customers` row containing `stripe_customer_id` starts `POST /api/billing/checkout/subscription`
- **THEN** the created Checkout session is associated with that Stripe customer id

#### Scenario: First subscription checkout establishes customer then reuses it
- **WHEN** the same user starts subscription checkout again after a prior session created the Stripe customer but did not complete payment (customer row exists)
- **THEN** subsequent Checkout session creation reuses the same Stripe customer id rather than creating a second customer for the same `user_id`

### Requirement: Verify Stripe webhook signatures on a dedicated route
The system SHALL expose `POST /api/billing/webhooks/stripe` that accepts Stripe webhook POSTs, reads the raw request body without prior JSON transformation, and verifies the `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` before processing. Unverified requests MUST NOT mutate billing state.

#### Scenario: Valid signature proceeds
- **WHEN** Stripe sends a webhook with a valid signature for the configured secret
- **THEN** the system parses the event and enters idempotent processing

#### Scenario: Invalid signature is rejected
- **WHEN** a request arrives with missing or invalid signature
- **THEN** the system responds with a non-success HTTP status and does not mutate billing state

### Requirement: Persist and idempotently process configured Stripe event types
When `STRIPE_WEBHOOKS_ENABLED` is true, the system SHALL handle at minimum these event types for authoritative billing mutation: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`. The system SHALL store each received event's Stripe event id in `billing_webhook_events` and SHALL treat duplicate deliveries of the same event id as safe no-ops after the first successful processing path.

#### Scenario: Duplicate event id does not double-apply
- **WHEN** Stripe retries delivery of an event with the same `id` as one already processed successfully
- **THEN** the system does not create duplicate grants, duplicate ledger rows for the same entitlement effect, or conflicting subscription mirror updates

### Requirement: Gate Stripe HTTP integrations behind documented feature flags
The system SHALL NOT create Checkout sessions, Portal sessions, or process billing mutations from webhooks when the corresponding feature flags are disabled (`BILLING_ENABLED`, `STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `TOPUPS_ENABLED` as applicable). Disabled routes SHALL return a consistent, non-success response or a documented safe payload that does not imply billing state changed.

#### Scenario: Webhooks disabled rejects processing
- **WHEN** `STRIPE_WEBHOOKS_ENABLED` is false and a signed webhook is received
- **THEN** the system does not apply subscription or grant side effects (may acknowledge or reject per implementation choice documented in tasks)

### Requirement: Webhook handlers MUST NOT silently drop initial paid grants when subscription metadata is available
When `invoice.paid` cannot resolve the Monti user via the `billing_customers` customer mapping, the system MUST attempt fallback resolution using `metadata.monti_user_id` on the Stripe subscription object. If fallback resolution succeeds, the system MUST repair the `billing_customers` mapping and complete paid grant creation. If both resolution paths fail, the system MUST log at warn level with sufficient context (Stripe customer ID, subscription ID) for operator investigation, then return without error so Stripe does not retry an unresolvable event.

#### Scenario: Fallback resolution succeeds and grant is created
- **WHEN** `invoice.paid` arrives, `findUserIdByStripeCustomerId` returns null, but the subscription's `metadata.monti_user_id` contains a valid Monti user ID
- **THEN** the system repairs `billing_customers.stripe_customer_id`, creates the paid recurring grant, and marks the event `processed`

#### Scenario: Both resolution paths fail
- **WHEN** `invoice.paid` arrives, `findUserIdByStripeCustomerId` returns null, and the subscription's `metadata.monti_user_id` is also absent
- **THEN** the system logs a warning with the Stripe customer ID and subscription ID and returns without creating a grant or throwing

