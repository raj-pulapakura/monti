## ADDED Requirements

### Requirement: Use creator-centered runtime status language
The chat thread workspace SHALL translate runtime and sandbox lifecycle states into concise user-facing creation language.

#### Scenario: Experience generation is in progress
- **WHEN** a run, tool invocation, or sandbox build is actively processing
- **THEN** the interface shows a creator-centered in-progress status label rather than internal runtime terminology

#### Scenario: Experience generation fails
- **WHEN** run or sandbox processing reaches a failure state
- **THEN** the interface shows a clear failure state with recovery guidance and preserved retry affordance

#### Scenario: Live event stream is reconnecting
- **WHEN** event updates are temporarily disconnected
- **THEN** the interface communicates reconnecting status in user-facing language without exposing transport-level details

### Requirement: Provide progressive loading feedback for chat and preview
The chat thread workspace SHALL provide staged feedback for thread hydration, message submission, and sandbox preview availability.

#### Scenario: Thread hydration is pending
- **WHEN** a valid thread route is loading hydration state
- **THEN** the chat surface shows a dedicated loading state and avoids blank or ambiguous content regions

#### Scenario: Preview is not yet available
- **WHEN** no active experience is ready for rendering
- **THEN** the sandbox region shows a purposeful waiting state that explains what will appear and when

#### Scenario: Message submission is pending
- **WHEN** the user submits a prompt
- **THEN** compose controls reflect submission state and prevent duplicate sends until completion

### Requirement: Harmonize chat and sandbox presentation primitives
The chat and sandbox panels SHALL use shared tokenized surface, spacing, and control patterns that preserve hierarchy on both desktop and mobile layouts.

#### Scenario: Desktop workspace layout
- **WHEN** the user views a thread on desktop breakpoints
- **THEN** chat and sandbox panels present a unified visual language with clear but cohesive hierarchy

#### Scenario: Mobile workspace layout
- **WHEN** the user views a thread on mobile breakpoints
- **THEN** stacked chat and sandbox panels retain the same component styling and state communication semantics as desktop
