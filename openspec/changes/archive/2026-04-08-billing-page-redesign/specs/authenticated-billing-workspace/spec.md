## MODIFIED Requirements

### Requirement: Display credit balances and costs in billing credits card
The `/billing` page SHALL display the user's available included credits and available top-up credits as visually distinct stat boxes with large numeric values and descriptive labels. When `reservedCreditsTotal` is greater than zero, the page SHALL display a "Reserved" stat box showing credits currently in use. Credit costs for `fast` and `quality` generation modes SHALL be displayed in a separate footnote row below the stat boxes, visually distinct from the balance information. Paid-plan users SHALL see a `Buy top-up pack` button. Free-plan users SHALL NOT see the top-up button.

#### Scenario: Free user views credit balances
- **WHEN** an authenticated free-plan user loads `/billing`
- **THEN** the page shows stat boxes for included credits available and top-up credits (zero), credit costs in a footnote row, and no top-up purchase button

#### Scenario: Paid user views credit balances
- **WHEN** an authenticated paid-plan user loads `/billing`
- **THEN** the page shows stat boxes for included credits available and top-up credits available, credit costs in a footnote row, and a `Buy top-up pack` button

#### Scenario: Paid user clicks buy top-up pack
- **WHEN** a paid-plan user clicks `Buy top-up pack`
- **THEN** the system calls `POST /api/billing/checkout/topup` and redirects the browser to the returned Stripe Checkout URL

#### Scenario: Reserved credits are visible when in flight
- **WHEN** `reservedCreditsTotal` is greater than zero
- **THEN** a "Reserved" stat box renders showing the count of credits currently in use

#### Scenario: Reserved credits are hidden when zero
- **WHEN** `reservedCreditsTotal` is zero or null
- **THEN** no reserved credits stat box renders

### Requirement: Provide Stripe invoice history access from billing workspace
The `/billing` page SHALL include an inline text-styled action (not a bordered button) that opens the Stripe Customer Portal scoped to invoice history. This SHALL use `POST /api/billing/portal` with `returnUrl: /billing`.

#### Scenario: User accesses invoice history
- **WHEN** an authenticated user clicks the invoice history text link on `/billing`
- **THEN** the system calls `POST /api/billing/portal` and redirects to the Stripe Customer Portal

#### Scenario: Portal session creation fails
- **WHEN** the portal session request fails
- **THEN** the page shows an inline error and does not navigate away
