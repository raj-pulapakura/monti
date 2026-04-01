# authenticated-billing-workspace Specification

## Purpose
TBD - created by archiving change build-billing-workspace. Update Purpose after archive.
## Requirements
### Requirement: Provide an authenticated billing workspace at /billing
The system SHALL expose a dedicated route `/billing` that requires an active session. Unauthenticated visitors SHALL be redirected to `/auth/sign-in` with a `next=/billing` return parameter. The page SHALL load billing state from `GET /api/billing/me` and render a plan card and a credits card without blocking navigation.

#### Scenario: Unauthenticated visitor opens /billing
- **WHEN** a visitor without a valid session requests `/billing`
- **THEN** the system redirects to `/auth/sign-in?next=/billing`

#### Scenario: Authenticated user opens /billing
- **WHEN** an authenticated user requests `/billing`
- **THEN** the system renders the billing workspace with a plan card and a credits card sourced from the billing API

#### Scenario: Billing API request fails
- **WHEN** `GET /api/billing/me` returns an error or network failure
- **THEN** the page renders a recoverable error state that does not prevent the user from navigating elsewhere

### Requirement: Display plan status in billing plan card
The `/billing` plan card SHALL display the user's current plan label (`Free` or `Paid`), the next credit refresh date for free users, and the current paid period end date for paid users. The card SHALL present a single contextual CTA: free users see an upgrade button that initiates subscription checkout; paid users see a manage subscription button that opens the Stripe Customer Portal.

#### Scenario: Free user views plan card
- **WHEN** an authenticated free-plan user loads `/billing`
- **THEN** the plan card shows `Free plan`, the next included credit refresh date, and an `Upgrade to paid plan` button

#### Scenario: Free user clicks upgrade
- **WHEN** a free-plan user clicks `Upgrade to paid plan`
- **THEN** the system calls `POST /api/billing/checkout/subscription` and redirects the browser to the returned Stripe Checkout URL

#### Scenario: Paid user views plan card
- **WHEN** an authenticated paid-plan user loads `/billing`
- **THEN** the plan card shows `Paid plan`, the current period end date, and a `Manage subscription` button

#### Scenario: Paid user clicks manage subscription
- **WHEN** a paid-plan user clicks `Manage subscription`
- **THEN** the system calls `POST /api/billing/portal` with `returnUrl: /billing` and redirects the browser to the returned Stripe Customer Portal URL

### Requirement: Display credit balances and costs in billing credits card
The `/billing` credits card SHALL display the user's available included credits, available top-up credits, and the credit cost for `fast` and `quality` generation modes. Paid-plan users SHALL see a `Buy top-up pack` button that initiates a top-up checkout. Free-plan users SHALL NOT see the top-up button.

#### Scenario: Free user views credits card
- **WHEN** an authenticated free-plan user loads `/billing`
- **THEN** the credits card shows included credits available, top-up credits (zero), fast and quality costs, and no top-up purchase button

#### Scenario: Paid user views credits card
- **WHEN** an authenticated paid-plan user loads `/billing`
- **THEN** the credits card shows included credits available, top-up credits available, fast and quality costs, and a `Buy top-up pack` button

#### Scenario: Paid user clicks buy top-up pack
- **WHEN** a paid-plan user clicks `Buy top-up pack`
- **THEN** the system calls `POST /api/billing/checkout/topup` and redirects the browser to the returned Stripe Checkout URL

### Requirement: Provide Stripe invoice history access from billing workspace
The `/billing` page SHALL include a link or button that opens the Stripe Customer Portal scoped to invoice history. This SHALL use `POST /api/billing/portal` with `returnUrl: /billing` and is the primary in-product path for users to view past invoices and payment receipts.

#### Scenario: User accesses invoice history
- **WHEN** an authenticated user clicks the invoice history link on `/billing`
- **THEN** the system calls `POST /api/billing/portal` and redirects to the Stripe Customer Portal

#### Scenario: Portal session creation fails
- **WHEN** the portal session request fails
- **THEN** the page shows an inline error and does not navigate away
