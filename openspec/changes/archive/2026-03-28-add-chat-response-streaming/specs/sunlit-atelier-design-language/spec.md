## MODIFIED Requirements

### Requirement: Standardize state-feedback presentation patterns
The system SHALL provide shared visual and copy patterns for loading, empty, success, warning/error, connectivity, and streaming feedback states, including long-running chat and preview interactions.

#### Scenario: Immediate feedback is shown after user action
- **WHEN** a user triggers an asynchronous action
- **THEN** the interface shows immediate state feedback within the initiating surface

#### Scenario: Long-running operations provide progressive feedback
- **WHEN** an operation remains in progress beyond instant response windows
- **THEN** the interface presents progressive, human-readable status messaging instead of static or ambiguous waiting text

#### Scenario: Streaming chat draft uses a shared in-progress treatment
- **WHEN** assistant output is actively streaming in the chat workspace
- **THEN** the interface uses a distinct shared draft-message treatment that differentiates in-progress assistant content from persisted conversation history

#### Scenario: Streaming feedback respects motion preferences
- **WHEN** loading or streaming states use motion cues
- **THEN** those cues follow the shared reduced-motion contract and remain legible when animation is minimized or removed

#### Scenario: Error states provide recovery guidance
- **WHEN** an operation fails on any first-party route
- **THEN** the interface shows a consistent error pattern with actionable recovery guidance
