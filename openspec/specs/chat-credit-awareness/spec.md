# chat-credit-awareness Specification

## Purpose
Define how the web app surfaces billing and per-mode credit costs in chat and home create flows, and how the UI soft-gates submission when the user cannot afford the selected generation mode.

## Requirements

### Requirement: Fetch billing state for chat and home
The authenticated chat thread page SHALL request `GET /api/billing/me` in parallel with thread hydration on mount. The authenticated home (create) workspace SHALL request `GET /api/billing/me` on load. Billing fetch failures SHALL be non-blocking: the interface remains usable without billing data.

#### Scenario: Billing fetch succeeds alongside thread hydration
- **WHEN** an authenticated user opens a chat thread page
- **THEN** billing state is fetched in parallel with thread hydration and both resolve independently

#### Scenario: Billing fetch fails
- **WHEN** `GET /api/billing/me` returns an error or network failure on the chat page
- **THEN** the chat page renders normally without a billing error state and the composer remains interactive

### Requirement: Show per-mode credit cost in the generation mode dropdown
When billing is enabled and fast/quality credit costs are available, the `GenerationModeDropdown` SHALL show each cost in brackets next to the **Fast** and **Quality** options (e.g. `[1 cr]`, `[5 cr]`) in the menu and in the closed trigger when that mode is selected. **Auto** has no bracketed cost in the control. A separate inline “credit pill” next to the dropdown SHALL NOT be used.

#### Scenario: Billing enabled, user selects fast
- **WHEN** billing is enabled and the user selects `fast` mode
- **THEN** the dropdown shows the fast credit cost in brackets for that mode

#### Scenario: Billing enabled, user selects quality
- **WHEN** billing is enabled and the user selects `quality` mode
- **THEN** the dropdown shows the quality credit cost in brackets for that mode

#### Scenario: Billing disabled or cost unavailable
- **WHEN** billing is disabled or credit costs are null
- **THEN** no bracketed costs are shown in the dropdown

### Requirement: Soft-gate submit when balance is insufficient for selected mode
When billing is enabled, billing data has loaded, and the user’s total spendable credits (included + top-up) are below the cost of the currently selected generation mode, the system SHALL disable only the **submit** control (create on home, send in chat). The prompt input and generation mode selector SHALL remain enabled so the user can switch to a cheaper mode or edit text. An inline warning SHALL appear with a leading status icon; free users see an upgrade link to `/billing`; paid users see a top-up action that initiates checkout.

#### Scenario: Free user has insufficient credits for selected mode
- **WHEN** a free-plan user’s spendable credits are below the cost of the currently selected generation mode and billing data has loaded
- **THEN** the submit button is disabled, the warning includes an `Upgrade` link to `/billing`, and the user can still change mode or edit the prompt

#### Scenario: Paid user has insufficient credits for selected mode
- **WHEN** a paid-plan user’s spendable credits are below the cost of the currently selected generation mode and billing data has loaded
- **THEN** the submit button is disabled and the warning includes a `Buy top-up` action

#### Scenario: User switches mode and balance becomes sufficient
- **WHEN** a user with insufficient credits for quality switches to fast mode and their balance covers the fast cost
- **THEN** the submit button is re-enabled and the inline warning is dismissed

#### Scenario: Billing data not yet loaded
- **WHEN** the billing fetch has not resolved at render time
- **THEN** the submit button is not disabled due to billing state alone and no inline billing warning is shown

#### Scenario: Billing disabled
- **WHEN** `billingEnabled` is false in the billing response
- **THEN** no soft-gate warning is rendered and the submit button is unaffected by billing state

### Requirement: No error shown when auto mode is silently downgraded server-side
When the backend silently downgrades a message submission from auto to fast mode due to insufficient quality credits, the frontend SHALL NOT display an error. The request completes normally from the frontend’s perspective.

#### Scenario: Auto mode submission succeeds after server-side downgrade
- **WHEN** a user submits with `generationMode = auto` and the server routes to fast due to insufficient quality credits
- **THEN** the frontend receives a normal success response, the run proceeds, and no error or warning is surfaced to the user
