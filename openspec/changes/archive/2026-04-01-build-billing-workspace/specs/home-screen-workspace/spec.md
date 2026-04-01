## MODIFIED Requirements

### Requirement: Show billing summary on authenticated home workspace

The authenticated home workspace SHALL request the billing summary from `GET /api/billing/me` when billing is enabled and SHALL display the effective plan label, remaining included credits, remaining top-up credits (when non-zero), and per-tier credit costs for `fast` and `quality` without blocking thread creation.

#### Scenario: Authenticated home loads billing strip

- **WHEN** an authenticated user loads `/` and billing is enabled
- **THEN** the workspace renders a visible billing summary showing plan label, included credits, and fast/quality costs

#### Scenario: Paid user has top-up credits

- **WHEN** an authenticated paid-plan user loads `/` and `topupCreditsAvailable` is greater than zero
- **THEN** the billing strip also displays the available top-up credit count

#### Scenario: Billing off or request failure does not break home

- **WHEN** billing is disabled or the billing summary request fails
- **THEN** the home workspace still renders the create input and thread carousel without a hard error state that prevents starting a new thread

### Requirement: Provide a billing navigation entry point in profile controls
The `FloatingProfileControls` component SHALL include a "Billing & plan" navigation item that links authenticated users to `/billing`. The item MUST appear in the profile dropdown menu alongside the existing sign-out action. This entry point is the primary in-product path for authenticated users to view their billing state, upgrade their plan, or manage their subscription.

#### Scenario: Authenticated user opens profile menu
- **WHEN** an authenticated user opens the profile dropdown in the home workspace or chat view
- **THEN** the menu includes a "Billing & plan" item linking to `/billing`

#### Scenario: User navigates to billing from profile menu
- **WHEN** an authenticated user selects "Billing & plan" from the profile dropdown
- **THEN** the system navigates to `/billing` and the billing workspace renders with the user's current plan and credit state
