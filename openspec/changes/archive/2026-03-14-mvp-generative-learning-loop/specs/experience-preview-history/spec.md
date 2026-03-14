## ADDED Requirements

### Requirement: Render generated experience in sandboxed iframe
The client MUST render generated `html`/`css`/`js` output exclusively inside a sandboxed iframe configuration that allows script execution but restricts top-level navigation and external origin access.

#### Scenario: Render generated experience in sandbox container
- **WHEN** the client receives a valid generated payload
- **THEN** it renders the experience inside a sandboxed iframe preview area

#### Scenario: Direct DOM injection is not used for preview
- **WHEN** the client displays generated output
- **THEN** it does not inject generated markup directly into the host application DOM

### Requirement: Provide loading and failure states during generation and refinement
The client SHALL display explicit loading status while requests are in-flight and clear error messaging when requests fail.

#### Scenario: Loading state during generation
- **WHEN** a generation request is pending
- **THEN** the client shows a loading indicator and prevents duplicate submission

#### Scenario: Error state after failed generation
- **WHEN** generation fails due to validation or provider errors
- **THEN** the client shows an actionable error message and allows retry

### Requirement: Persist recent creations locally with bounded history
The client MUST persist recent generated experiences in browser local storage, retain at most 10 entries, and support reopening any retained entry.

#### Scenario: New creation is saved to history
- **WHEN** generation or refinement succeeds
- **THEN** the client stores the resulting experience metadata and payload in local storage history

#### Scenario: History limit is enforced
- **WHEN** an eleventh creation is saved
- **THEN** the oldest stored creation is removed and only the latest 10 remain

#### Scenario: Reopen recent creation
- **WHEN** a user selects an item from recent creations
- **THEN** the client restores and renders that saved experience in the preview area
