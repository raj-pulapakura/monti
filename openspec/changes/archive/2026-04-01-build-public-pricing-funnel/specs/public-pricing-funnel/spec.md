## ADDED Requirements

### Requirement: Display real plan values on public pricing surfaces
The system SHALL render the current plan values as literal figures on all public pricing surfaces. The landing page pricing section and the `/pricing` page MUST both display: free monthly allowance (`15 credits`), paid monthly allowance (`150 credits`), paid plan price (`$10/month`), fast run cost (`1 credit`), quality run cost (`5 credits`), and top-up pack (`50 credits for $4`). These values MUST be sourced from or consistent with the active `launch-v1` pricing rule, not hand-coded in isolation from the billing contract.

#### Scenario: Anonymous visitor reads pricing numbers on the landing page
- **WHEN** an unauthenticated visitor views the landing page pricing section
- **THEN** the page displays the free allowance (15 credits/month), paid allowance (150 credits/month), price ($10/month), fast cost (1 credit), quality cost (5 credits), and top-up pack (50 credits for $4) as readable figures

#### Scenario: Anonymous visitor reads pricing numbers on the dedicated pricing page
- **WHEN** an unauthenticated visitor opens `/pricing`
- **THEN** the page displays the same plan figures as the landing section with no discrepancy between surfaces

### Requirement: Render an inline pricing section on the marketing landing page
The `MarketingLanding` component in `web/app/page.tsx` SHALL include a pricing section below the existing feature cards. The section MUST present a two-column comparison of the free and paid plans showing real allowances, credit costs, and top-up availability. The section MUST include CTAs consistent with the auth-aware CTA rules for unauthenticated visitors.

#### Scenario: Unauthenticated visitor sees pricing section on the landing page
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the page renders a pricing section with a free column and a paid column, each showing real plan figures and a corresponding CTA

#### Scenario: Landing pricing section links to the full pricing page
- **WHEN** an unauthenticated visitor views the landing pricing section
- **THEN** there is a visible link to `/pricing` for more detail

### Requirement: Auto-initiate subscription checkout at `/checkout/start`
The system SHALL provide a `/checkout/start` route that requires authentication, immediately POSTs to `POST /api/billing/checkout/subscription` on mount, and redirects the browser to the returned Stripe checkout URL without requiring any secondary user confirmation on that page. The route MUST show a visible loading state while the session is being created. If the POST fails, the page MUST display an error with a link back to `/pricing`.

#### Scenario: Authenticated free user lands on /checkout/start
- **WHEN** an authenticated user with a free plan is routed to `/checkout/start`
- **THEN** the page shows a loading indicator, POSTs to create a subscription checkout session, and redirects the browser to the Stripe-hosted checkout URL

#### Scenario: Unauthenticated user requests /checkout/start
- **WHEN** an unauthenticated visitor requests `/checkout/start`
- **THEN** the system redirects to `/auth/sign-in?next=/checkout/start` before initiating checkout

#### Scenario: Checkout session creation fails
- **WHEN** the POST to create a checkout session returns an error
- **THEN** the page displays an error message and a link back to `/pricing` rather than leaving the user on a broken state

### Requirement: Confirm subscription activation at `/checkout/success`
The system SHALL provide a `/checkout/success` route that polls `GET /api/billing/me` at a short interval after Stripe redirects back to confirm that the paid plan has activated. Polling MUST stop and display a success confirmation when `plan === 'paid'` is detected. If `plan === 'paid'` is not detected within approximately 10 seconds of polling, the page MUST fall back to a static activation-pending message. The page MUST provide a link to the home workspace regardless of which state is shown. The route MUST NOT use the Stripe `session_id` return parameter to grant or confirm credits — polling the backend is the only authority.

#### Scenario: Webhook activates plan within polling window
- **WHEN** a user returns to `/checkout/success` and the backend detects `plan === 'paid'` within the polling window
- **THEN** the page transitions from a loading/polling state to a confirmed activation message that includes remaining credit balance

#### Scenario: Webhook has not yet fired when polling window expires
- **WHEN** polling completes without detecting `plan === 'paid'`
- **THEN** the page displays a static activation-pending message informing the user that their subscription is being activated and credits will arrive shortly

#### Scenario: User navigates home from success page
- **WHEN** the success page is in any state (polling, confirmed, or pending fallback)
- **THEN** a link to the home workspace is visible and functional

### Requirement: Provide a recovery path at `/checkout/cancel`
The system SHALL provide a `/checkout/cancel` route for users who abandon the Stripe-hosted checkout. The page MUST present a reassuring message and a prominent link back to `/pricing`. The page MUST NOT display an error or failure language — abandoning checkout is a normal user action.

#### Scenario: User abandons Stripe checkout and returns to the app
- **WHEN** a user cancels or abandons the Stripe checkout and Stripe redirects them to `/checkout/cancel`
- **THEN** the page renders a calm no-pressure message and a link back to `/pricing`
