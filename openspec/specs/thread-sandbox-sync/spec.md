# thread-sandbox-sync Specification

## Purpose
TBD - created by archiving change chat-native-tool-orchestration. Update Purpose after archive.
## Requirements
### Requirement: Persist thread-scoped sandbox materialized state
The system SHALL persist a sandbox state record per thread that captures preview status (`empty`, `creating`, `ready`, `error`) and the active artifact/version reference.

#### Scenario: New thread initializes sandbox state
- **WHEN** a thread is created
- **THEN** its sandbox state is initialized to `empty` with no active artifact reference

#### Scenario: Successful tool output updates active artifact
- **WHEN** an experience-generation tool invocation succeeds
- **THEN** sandbox state transitions to `ready` and points to the latest persisted artifact version for that thread

### Requirement: Reflect generation lifecycle in sandbox state
The system MUST update sandbox status transitions in sync with run/tool execution lifecycle.

#### Scenario: Tool execution starts
- **WHEN** generate/refine tool invocation enters `running`
- **THEN** sandbox state transitions to `creating`

#### Scenario: Tool execution fails
- **WHEN** generate/refine tool invocation fails
- **THEN** sandbox state transitions to `error` and includes failure metadata suitable for UI display

### Requirement: Emit sandbox update events for frontend synchronization
The system SHALL emit canonical `sandbox_updated` events whenever sandbox state changes.

#### Scenario: Ready state event emitted
- **WHEN** sandbox state transitions to `ready`
- **THEN** event stream emits `sandbox_updated` containing new status and artifact/version identifiers

#### Scenario: Error state event emitted
- **WHEN** sandbox state transitions to `error`
- **THEN** event stream emits `sandbox_updated` with normalized error information

### Requirement: Provide snapshot retrieval for reconnect and refresh
The system SHALL provide a snapshot API that returns current sandbox state and render payload references for hydration after reconnect.

#### Scenario: Client reconnects after disconnect
- **WHEN** the client rehydrates a thread after losing event stream connection
- **THEN** the system returns the latest sandbox state so UI can reconcile without replaying full history

