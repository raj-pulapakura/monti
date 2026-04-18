## MODIFIED Requirements

### Requirement: Reject message submission when balance is insufficient for the minimum generation tier
The system SHALL check the submitting user's spendable credit balance against the cost of the **fast** (minimum) generation tier before queuing a conversation run. If the balance is below the fast-tier cost, the system SHALL return an error response with code `INSUFFICIENT_CREDITS` and SHALL NOT queue a run or invoke the LLM. This check SHALL only execute when `BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED` are both true. The generation mode is not known at submit time and SHALL NOT be part of the pre-submit check.

#### Scenario: User submits with insufficient credits for the minimum tier
- **WHEN** a user's spendable credits are below the fast-mode cost and submits a message
- **THEN** the API returns an error with code `INSUFFICIENT_CREDITS` and no conversation run is queued

#### Scenario: User submits with sufficient credits for the minimum tier
- **WHEN** a user's spendable balance meets or exceeds the fast-mode cost
- **THEN** the message is accepted and a conversation run is queued normally, regardless of what quality mode the user may eventually select at the confirmation gate

#### Scenario: Enforcement disabled allows submission regardless of balance
- **WHEN** `BILLING_ENABLED` is false or `CREDIT_ENFORCEMENT_ENABLED` is false
- **THEN** the credit pre-check is skipped and the message is accepted regardless of the user's credit balance

#### Scenario: Billing data unavailable at submit time
- **WHEN** the credit balance read fails due to a transient error
- **THEN** the system fails open — the message is accepted and the run is queued — and the error is logged

## REMOVED Requirements

### Requirement: Silently downgrade auto mode to fast when quality credits are unaffordable
**Reason**: Auto generation mode is removed entirely. Mode selection now happens at the confirmation gate, not at message submit time. There is no auto mode to downgrade.
**Migration**: No migration needed — callers should no longer send `generationMode: 'auto'`. Any existing `auto` values in persisted `content_json` are treated as unset (no mode override).
