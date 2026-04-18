## MODIFIED Requirements

### Requirement: Fetch billing state for chat and home
The authenticated chat thread page SHALL request `GET /api/billing/me` in parallel with thread hydration on mount. The authenticated home (create) workspace SHALL request `GET /api/billing/me` on load. Billing fetch failures SHALL be non-blocking: the interface remains usable without billing data.

#### Scenario: Billing fetch succeeds alongside thread hydration
- **WHEN** an authenticated user opens a chat thread page
- **THEN** billing state is fetched in parallel with thread hydration and both resolve independently

#### Scenario: Billing fetch fails
- **WHEN** `GET /api/billing/me` returns an error or network failure on the chat page
- **THEN** the chat page renders normally without a billing error state and the composer remains interactive

### Requirement: Soft-gate submit when balance is insufficient for the minimum generation tier
When billing is enabled, billing data has loaded, and the user's total spendable credits (included + top-up) are below the cost of the **fast** (minimum) tier, the system SHALL disable the submit control. The prompt input SHALL remain enabled. An inline warning SHALL appear with a leading status icon; free users see an upgrade link to `/billing`; paid users see a top-up action. The generation mode selector SHALL NOT exist in the composer — mode is selected at the confirmation gate.

#### Scenario: User has insufficient credits for the minimum tier
- **WHEN** a user's spendable credits are below the fast-mode cost and billing data has loaded
- **THEN** the submit button is disabled and the inline warning appears; the prompt input remains editable

#### Scenario: User has sufficient credits for the minimum tier
- **WHEN** a user's spendable balance meets or exceeds the fast-mode cost
- **THEN** the submit button is enabled regardless of quality-mode affordability (mode is chosen later at the gate)

#### Scenario: Billing data not yet loaded
- **WHEN** the billing fetch has not resolved at render time
- **THEN** the submit button is not disabled due to billing state alone and no inline billing warning is shown

#### Scenario: Billing disabled
- **WHEN** `billingEnabled` is false in the billing response
- **THEN** no soft-gate warning is rendered and the submit button is unaffected by billing state

### Requirement: Show credit costs for each mode in the confirmation gate
When billing is enabled and credit costs are available, the confirmation gate UI SHALL display the credit cost for both Draft (fast) and High Quality (quality) modes next to their respective selection options. This replaces the previous per-mode cost display in the generation mode dropdown, which no longer exists.

#### Scenario: Billing enabled — gate shows costs
- **WHEN** the confirmation gate is displayed and billing is enabled with costs available
- **THEN** both Draft and High Quality options display their respective credit costs

#### Scenario: Billing disabled — gate shows no costs
- **WHEN** the confirmation gate is displayed and billing is disabled or costs are unavailable
- **THEN** the gate still shows mode options but without credit cost labels

### Requirement: UI blocks all chat input while confirmation gate is open
When the confirmation gate is visible (run status `awaiting_confirmation`), the composer input, submit button, and any other message-sending controls SHALL be disabled. The user can only interact with the confirmation gate (confirm or cancel). This is a hard UI invariant — the backend does not handle concurrent message submission while a confirmation is pending.

#### Scenario: Gate open — composer disabled
- **WHEN** the active run status is `awaiting_confirmation` and the gate is rendered
- **THEN** the chat composer input and submit button are disabled and non-interactive

#### Scenario: Gate dismissed (confirmed or cancelled) — composer re-enabled
- **WHEN** the user confirms or cancels and the run resumes or completes
- **THEN** the composer becomes interactive again once the gate is dismissed

## REMOVED Requirements

### Requirement: Show per-mode credit cost in the generation mode dropdown
**Reason**: The generation mode dropdown is removed from the composer. Mode selection now happens at the confirmation gate after the LLM decides to generate. There is no dropdown to show costs in.
**Migration**: Credit cost display moves to the confirmation gate UI under the new `chat-credit-awareness` requirement "Show credit costs for each mode in the confirmation gate".

### Requirement: No error shown when auto mode is silently downgraded server-side
**Reason**: Auto generation mode is removed. The server no longer performs silent mode downgrade. This frontend behavior has no corresponding backend action to suppress.
**Migration**: No migration needed — this scenario can no longer occur.
