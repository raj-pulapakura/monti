# chat-credit-awareness Specification

## Purpose
TBD - created by archiving change build-billing-workspace. Update Purpose after archive.
## Requirements
### Requirement: Fetch billing state on chat thread page load
The chat thread page SHALL request `GET /api/billing/me` in parallel with thread hydration on mount. The billing fetch SHALL NOT block thread hydration or the event stream connection. A billing fetch failure SHALL be handled silently - the chat interface remains fully functional without billing data.

#### Scenario: Billing fetch succeeds alongside thread hydration
- **WHEN** an authenticated user opens a chat thread page
- **THEN** billing state is fetched in parallel with thread hydration and both resolve independently

#### Scenario: Billing fetch fails
- **WHEN** `GET /api/billing/me` returns an error or network failure on the chat page
- **THEN** the chat page renders normally without a billing error state and the composer remains interactive

### Requirement: Display per-mode credit cost near GenerationModeDropdown
When billing is enabled and credit costs are available, the chat composer area SHALL display the credit cost of the currently selected generation mode as a compact label adjacent to the `GenerationModeDropdown`. The label SHALL update when the user changes modes.

#### Scenario: Billing enabled, user on fast mode
- **WHEN** billing is enabled and the user has selected `fast` mode
- **THEN** the cost label near the mode selector shows the fast credit cost (e.g., `1 cr`)

#### Scenario: Billing enabled, user on quality mode
- **WHEN** billing is enabled and the user has selected `quality` mode
- **THEN** the cost label near the mode selector shows the quality credit cost (e.g., `5 cr`)

#### Scenario: Billing disabled or cost unavailable
- **WHEN** billing is disabled or credit costs are null
- **THEN** no cost label is rendered and the composer layout is unchanged

### Requirement: Soft-gate composer when balance is insufficient for selected mode
When billing is enabled and the user's total available credits (included + top-up) are below the cost of the currently selected generation mode, the system SHALL disable the composer submit button and render an inline warning message. The warning SHALL include a contextual recovery CTA: free users see an upgrade link; paid users see a top-up link.

#### Scenario: Free user has insufficient credits
- **WHEN** a free-plan user's available credits are below the cost of the selected mode
- **THEN** the submit button is disabled and the inline warning includes an `Upgrade` link pointing to `/billing`

#### Scenario: Paid user has insufficient credits
- **WHEN** a paid-plan user's available credits are below the cost of the selected mode
- **THEN** the submit button is disabled and the inline warning includes a `Buy top-up` action that calls `POST /api/billing/checkout/topup`

#### Scenario: User has sufficient credits
- **WHEN** available credits meet or exceed the cost of the selected mode
- **THEN** no soft-gate warning is shown and the submit button is enabled (subject to other existing constraints)

#### Scenario: Billing data not yet loaded
- **WHEN** the billing fetch has not yet resolved
- **THEN** no soft-gate warning is rendered and the submit button is not disabled due to billing state alone
