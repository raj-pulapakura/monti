## ADDED Requirements

### Requirement: Generate contextual refinement suggestions for the active experience version

The system SHALL generate a small set of contextual refinement suggestions for a thread's active experience version after a successful version increment. Suggestion generation SHALL be grounded in explicit bounded context from the latest version and recent thread intent, and SHALL use an authenticated backend flow rather than client-only heuristics.

#### Scenario: Successful version increment produces suggestions
- **WHEN** a thread's active `experienceVersionId` changes to a newly ready version
- **THEN** the system makes contextual refinement suggestions available for that version

#### Scenario: Suggestion generation uses bounded artifact and thread context
- **WHEN** the backend prepares the suggestion-generation request for an active experience version
- **THEN** it includes explicit bounded context from the latest version and recent user refinement intent sufficient to generate grounded follow-up prompts without requiring a full raw artifact dump

#### Scenario: Suggestions are scoped to the authenticated thread owner
- **WHEN** a user requests contextual refinement suggestions for a thread they own
- **THEN** the system returns suggestions only for that thread's active version and does not expose another user's thread context

### Requirement: Show contextual suggestion chips near the composer only

The chat thread workspace SHALL render contextual refinement suggestion chips adjacent to the composer and MUST NOT continue rendering the legacy generic add-to-prompt pill set once contextual suggestions are enabled.

#### Scenario: Suggestions are available for the active version
- **WHEN** contextual refinement suggestions exist for the thread's current active version
- **THEN** the workspace shows those suggestion chips near the composer

#### Scenario: Legacy static pills are removed
- **WHEN** contextual refinement suggestions are enabled in the chat workspace
- **THEN** the interface does not render the previous static generic prompt pills

#### Scenario: Suggestion chip does not appear in sandbox header region
- **WHEN** the thread workspace renders both the composer and sandbox preview
- **THEN** contextual refinement suggestions are presented with the composer workflow rather than as a second chip row in the sandbox region

### Requirement: Selecting a suggestion prepares a follow-up refinement without sending it

Selecting a contextual refinement suggestion SHALL set the composer text to that suggestion's prompt and leave the message unsent so the user can edit or submit it manually.

#### Scenario: User clicks a suggestion chip
- **WHEN** a user activates a contextual refinement suggestion chip
- **THEN** the composer input is replaced with that suggestion prompt text

#### Scenario: Suggestion selection does not auto-submit
- **WHEN** a user activates a contextual refinement suggestion chip
- **THEN** the system does not submit a new message solely because the chip was selected

### Requirement: Suggestion lifecycle tracks version changes without blocking refinement

The chat workspace SHALL refresh contextual refinement suggestions when the active experience version changes and SHALL keep the rest of the thread workflow usable if suggestions are loading, unavailable, or fail to generate.

#### Scenario: New version replaces prior suggestions
- **WHEN** a newer active `experienceVersionId` becomes current for the thread
- **THEN** the workspace replaces stale suggestions from the previous version with suggestions for the new version

#### Scenario: Suggestions are unavailable for the current version
- **WHEN** contextual suggestion generation fails, times out, or returns no suggestions for the active version
- **THEN** the user can still type in the composer, change generation mode, and submit a refinement without a blocking error
