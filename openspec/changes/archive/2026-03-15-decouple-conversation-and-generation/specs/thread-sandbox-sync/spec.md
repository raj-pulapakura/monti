## MODIFIED Requirements

### Requirement: Reflect generation lifecycle in sandbox state
The system MUST update sandbox status transitions in sync with generation execution lifecycle initiated from conversation tool invocations.

#### Scenario: Generation tool execution starts
- **WHEN** a `generate_experience` invocation enters running state
- **THEN** sandbox state transitions to `creating`

#### Scenario: Generation tool execution succeeds
- **WHEN** a `generate_experience` invocation succeeds
- **THEN** sandbox state transitions to `ready` and references the latest persisted artifact/version for the thread

#### Scenario: Generation tool execution fails
- **WHEN** a `generate_experience` invocation fails
- **THEN** sandbox state transitions to `error` and includes normalized failure metadata suitable for UI display

### Requirement: Emit sandbox update events for frontend synchronization
The system SHALL emit canonical `sandbox_updated` events whenever sandbox state changes, with correlation fields that allow frontend reducers to reconcile conversation and generation progress.

#### Scenario: Ready state event emitted
- **WHEN** sandbox transitions to `ready`
- **THEN** event stream emits `sandbox_updated` with status and artifact/version identifiers

#### Scenario: Error state event emitted
- **WHEN** sandbox transitions to `error`
- **THEN** event stream emits `sandbox_updated` with normalized error information
