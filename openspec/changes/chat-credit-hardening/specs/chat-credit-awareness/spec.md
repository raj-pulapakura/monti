## ADDED Requirements

### Requirement: Disable composer submit button when balance is insufficient for selected mode
The chat composer submit button SHALL be disabled and an inline warning SHALL be rendered when billing is enabled, billing data has loaded, and the user's total spendable credits (included + top-up) are below the cost of the currently selected generation mode. The warning SHALL include a contextual recovery CTA: free users see an upgrade link to `/billing`; paid users see a top-up action that initiates checkout. When the user's balance is sufficient the warning SHALL NOT be shown and the submit button SHALL be enabled (subject to other existing constraints such as an empty input or an active run).

#### Scenario: Free user has insufficient credits for selected mode
- **WHEN** a free-plan user's spendable credits are below the cost of the currently selected generation mode and billing data has loaded
- **THEN** the submit button is disabled and the inline warning includes an `Upgrade` link to `/billing`

#### Scenario: Paid user has insufficient credits for selected mode
- **WHEN** a paid-plan user's spendable credits are below the cost of the currently selected generation mode and billing data has loaded
- **THEN** the submit button is disabled and the inline warning includes a `Buy top-up` action

#### Scenario: User switches mode and balance becomes sufficient
- **WHEN** a user with insufficient credits for quality switches to fast mode and their balance covers the fast cost
- **THEN** the submit button is re-enabled and the inline warning is dismissed

#### Scenario: Billing data not yet loaded
- **WHEN** the billing fetch has not resolved at render time
- **THEN** the submit button is not disabled due to billing state alone and no inline warning is shown

#### Scenario: Billing disabled
- **WHEN** `billingEnabled` is false in the billing response
- **THEN** no soft-gate warning is rendered and the submit button is unaffected by billing state

### Requirement: No error shown when auto mode is silently downgraded server-side
When the backend silently downgrades a message submission from auto to fast mode due to insufficient quality credits, the frontend SHALL NOT display an error. The request completes normally from the frontend's perspective.

#### Scenario: Auto mode submission succeeds after server-side downgrade
- **WHEN** a user submits a message with `generationMode = auto` and the server routes it to fast due to insufficient quality credits
- **THEN** the frontend receives a normal success response, the run proceeds, and no error or warning is surfaced to the user
