## ADDED Requirements

### Requirement: Expose Stripe Checkout and Portal session endpoints

The system SHALL provide authenticated HTTP endpoints that create Stripe Billing objects and return a client-redirect URL for **Stripe-hosted** Checkout or the Stripe Customer Portal. The endpoints SHALL be `POST /api/billing/checkout/subscription`, `POST /api/billing/checkout/topup`, and `POST /api/billing/portal`, each requiring a valid Monti user session. Responses SHALL include sufficient information for the client to redirect the browser to Stripe (at minimum the session `url`).

#### Scenario: Authenticated user starts subscription checkout

- **WHEN** an authenticated user posts to `POST /api/billing/checkout/subscription` with `BILLING_ENABLED` true and a configured Stripe subscription price
- **THEN** the system ensures a Stripe customer mapping exists, creates a Stripe Checkout session in **subscription** mode for the configured paid monthly price, records a `billing_checkout_sessions` row for audit, and returns the Checkout session URL

#### Scenario: Eligible paid user starts top-up checkout

- **WHEN** an authenticated user with an active paid entitlement posts to `POST /api/billing/checkout/topup` and top-ups are enabled
- **THEN** the system creates a Stripe Checkout session in **payment** mode for the configured top-up price, records a `billing_checkout_sessions` row, and returns the Checkout session URL

#### Scenario: Paid user opens customer portal

- **WHEN** an authenticated user with a Stripe customer mapping posts to `POST /api/billing/portal` and the portal feature flag is enabled
- **THEN** the system creates a Stripe Billing Portal session with a configured return URL and returns the portal URL

### Requirement: Reuse Stripe customer and Checkout patterns that discourage duplicate paid subscriptions

When creating a subscription Checkout session, the system SHALL use the persisted `billing_customers.stripe_customer_id` for that Monti user when present and SHALL follow Stripe’s recommended subscription Checkout patterns for launch (single customer per user, no ad-hoc second customer for the same `user_id`) so a user is not pushed into parallel unintended paid subscriptions by default.

#### Scenario: Subscription checkout uses mapped customer id

- **WHEN** an authenticated user with an existing `billing_customers` row containing `stripe_customer_id` starts `POST /api/billing/checkout/subscription`
- **THEN** the created Checkout session is associated with that Stripe customer id

#### Scenario: First subscription checkout establishes customer then reuses it

- **WHEN** the same user starts subscription checkout again after a prior session created the Stripe customer but did not complete payment (customer row exists)
- **THEN** subsequent Checkout session creation reuses the same Stripe customer id rather than creating a second customer for the same `user_id`

### Requirement: Verify Stripe webhook signatures on a dedicated route

The system SHALL expose `POST /api/billing/webhooks/stripe` that accepts Stripe webhook POSTs, reads the **raw request body** without prior JSON transformation, and verifies the `Stripe-Signature` header using `STRIPE_WEBHOOK_SECRET` before processing. Unverified requests MUST NOT mutate billing state.

#### Scenario: Valid signature proceeds

- **WHEN** Stripe sends a webhook with a valid signature for the configured secret
- **THEN** the system parses the event and enters idempotent processing

#### Scenario: Invalid signature is rejected

- **WHEN** a request arrives with missing or invalid signature
- **THEN** the system responds with a non-success HTTP status and does not mutate billing state

### Requirement: Persist and idempotently process configured Stripe event types

When `STRIPE_WEBHOOKS_ENABLED` is true, the system SHALL handle at minimum these event types for authoritative billing mutation: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`. The system SHALL store each received event’s Stripe event id in `billing_webhook_events` and SHALL treat duplicate deliveries of the same event id as safe no-ops after the first successful processing path.

#### Scenario: Duplicate event id does not double-apply

- **WHEN** Stripe retries delivery of an event with the same `id` as one already processed successfully
- **THEN** the system does not create duplicate grants, duplicate ledger rows for the same entitlement effect, or conflicting subscription mirror updates

### Requirement: Gate Stripe HTTP integrations behind documented feature flags

The system SHALL NOT create Checkout sessions, Portal sessions, or process billing mutations from webhooks when the corresponding feature flags are disabled (`BILLING_ENABLED`, `STRIPE_WEBHOOKS_ENABLED`, `BILLING_PORTAL_ENABLED`, `TOPUPS_ENABLED` as applicable). Disabled routes SHALL return a consistent, non-success response or a documented safe payload that does not imply billing state changed.

#### Scenario: Webhooks disabled rejects processing

- **WHEN** `STRIPE_WEBHOOKS_ENABLED` is false and a signed webhook is received
- **THEN** the system does not apply subscription or grant side effects (may acknowledge or reject per implementation choice documented in tasks)
