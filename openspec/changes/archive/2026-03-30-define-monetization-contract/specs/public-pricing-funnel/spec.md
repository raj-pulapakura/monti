# public-pricing-funnel Specification

## ADDED Requirements

### Requirement: Publish launch pricing on public Monti surfaces
The web application SHALL present Monti's launch pricing story on public, unauthenticated surfaces. At minimum, the unauthenticated root landing experience and a dedicated shareable `/pricing` route MUST describe the free allowance, paid allowance, `fast` and `quality` credit costs, top-up availability for paid users, and the no-automatic-overage launch posture.

#### Scenario: Anonymous visitor sees pricing on the landing surface
- **WHEN** an unauthenticated visitor opens the root marketing experience
- **THEN** the page includes visible pricing information that summarizes Monti's launch plans and credit model

#### Scenario: Anonymous visitor opens the dedicated pricing route
- **WHEN** an unauthenticated visitor requests `/pricing`
- **THEN** the system renders a public pricing page without requiring authentication

### Requirement: Keep public pricing content consistent with the active billing contract
The system MUST keep public pricing content aligned with the current monetization contract rather than duplicating uncontrolled copy. Public pricing surfaces and authenticated billing entry points MUST resolve the same current plan values, credit costs, and launch rules.

#### Scenario: Current plan values are reflected consistently across surfaces
- **WHEN** the application renders the public pricing page and an authenticated upgrade entry point during the same pricing-rule version
- **THEN** both surfaces display the same current allowances, credit costs, and top-up rules

#### Scenario: A later pricing revision updates the public funnel
- **WHEN** Monti changes the active pricing-rule version in a future release
- **THEN** the public pricing surfaces update to the new current contract without requiring manual copy divergence from the billing backend

### Requirement: Route pricing calls to action according to authentication and entitlement state
The system SHALL route pricing and billing calls to action based on the visitor's session and entitlement state. Signed-out users MUST be routed into authentication, signed-in free users MUST be able to begin upgrade checkout, and signed-in paid users MUST be able to reach billing management or top-up purchase actions instead of a generic upgrade flow.

#### Scenario: Signed-out visitor selects an upgrade CTA
- **WHEN** an unauthenticated visitor clicks a paid conversion CTA from a public pricing surface
- **THEN** the system routes the visitor into the authentication flow with the intended billing action preserved

#### Scenario: Signed-in free user selects an upgrade CTA
- **WHEN** an authenticated user without an active paid entitlement clicks an upgrade CTA
- **THEN** the system can continue directly into the paid checkout initiation path

#### Scenario: Signed-in paid user opens pricing
- **WHEN** an authenticated user with an active paid entitlement visits the pricing experience
- **THEN** the system offers billing-management and paid-user actions instead of presenting only an upgrade CTA

### Requirement: Resume billing intent after authentication
The system MUST preserve the user's selected billing intent across sign-in and sign-up flows and resume the intended post-auth action once authentication completes. Launch billing intents MUST include at least paid plan signup and paid-user top-up purchase.

#### Scenario: Visitor resumes paid upgrade after sign-up
- **WHEN** a signed-out visitor chooses the paid plan and completes sign-up successfully
- **THEN** the application resumes the pending paid upgrade flow without requiring the user to reselect the plan

#### Scenario: Visitor resumes paid upgrade after sign-in
- **WHEN** a signed-out existing user chooses the paid plan and then signs in successfully
- **THEN** the application resumes the pending paid upgrade flow for that authenticated account

#### Scenario: Invalid or expired billing intent does not produce a broken flow
- **WHEN** authentication completes but the preserved billing intent is missing, invalid, or no longer permitted for the current entitlement state
- **THEN** the application routes the user to a safe pricing or billing surface instead of attempting an invalid checkout action
