## ADDED Requirements

### Requirement: Reject message submission when balance is insufficient for the selected mode
The system SHALL check the submitting user's spendable credit balance against the cost of the selected generation mode before queuing a conversation run. If the balance is insufficient, the system SHALL return an error response and SHALL NOT queue a run or invoke the LLM. This check SHALL only execute when `BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED` are both true.

#### Scenario: User submits with insufficient credits for quality mode
- **WHEN** a user with fewer spendable credits than the quality-mode cost submits a message with `generationMode = quality`
- **THEN** the API returns an error with code `INSUFFICIENT_CREDITS` and no conversation run is queued

#### Scenario: User submits with insufficient credits for fast mode
- **WHEN** a user with fewer spendable credits than the fast-mode cost submits a message with `generationMode = fast`
- **THEN** the API returns an error with code `INSUFFICIENT_CREDITS` and no conversation run is queued

#### Scenario: User submits with sufficient credits
- **WHEN** a user's spendable balance meets or exceeds the cost of the selected mode
- **THEN** the message is accepted and a conversation run is queued normally

#### Scenario: Enforcement disabled allows submission regardless of balance
- **WHEN** `BILLING_ENABLED` is false or `CREDIT_ENFORCEMENT_ENABLED` is false
- **THEN** the credit pre-check is skipped and the message is accepted regardless of the user's credit balance

#### Scenario: Billing data unavailable at submit time
- **WHEN** the credit balance read fails due to a transient error
- **THEN** the system fails open — the message is accepted and the run is queued — and the error is logged

### Requirement: Silently downgrade auto mode to fast when quality credits are unaffordable
When `generationMode` is `auto` and the user's spendable balance is below the quality-mode cost but at or above the fast-mode cost, the system SHALL rewrite the effective generation mode to `fast` before queuing the run. No error SHALL be returned to the caller. This downgrade SHALL only execute when `BILLING_ENABLED` and `CREDIT_ENFORCEMENT_ENABLED` are both true.

#### Scenario: Auto mode downgraded to fast due to insufficient quality credits
- **WHEN** a user with spendable credits sufficient for fast but not quality submits a message with `generationMode = auto`
- **THEN** the run is queued with effective mode `fast`, no error is returned, and the downgrade is recorded in the structured application log

#### Scenario: Auto mode uses quality when balance is sufficient
- **WHEN** a user with spendable credits sufficient for quality submits a message with `generationMode = auto`
- **THEN** the run is queued with effective mode `quality` (or resolved normally by existing routing logic)

#### Scenario: Auto mode with insufficient credits for even fast tier
- **WHEN** a user with spendable credits below the fast-mode cost submits a message with `generationMode = auto`
- **THEN** the API returns an error with code `INSUFFICIENT_CREDITS` and no run is queued
