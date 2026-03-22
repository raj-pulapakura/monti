## ADDED Requirements

### Requirement: Align authentication surfaces with shared design language
Sign-in, sign-up, forgot-password, and reset-password screens SHALL use the Sunlit Atelier token, typography, and component hierarchy system.

#### Scenario: User opens any authentication route
- **WHEN** a user navigates to an authentication page
- **THEN** the page renders with shared surface, type, input, and action styling defined by the design language

#### Scenario: Auth provider options are rendered
- **WHEN** OAuth provider actions are shown
- **THEN** provider controls use consistent interaction-state styling with other primary and secondary auth actions

### Requirement: Normalize authentication state-feedback messaging
Authentication flows SHALL present loading, success, and error feedback with concise and consistent language patterns.

#### Scenario: Authentication request is in flight
- **WHEN** sign-in, sign-up, recovery, or reset actions are submitted
- **THEN** the initiating control reflects an in-progress state and duplicate submissions are prevented

#### Scenario: Recoverable authentication error occurs
- **WHEN** an auth action fails
- **THEN** the page displays a standardized error pattern with clear next-step guidance

#### Scenario: Non-enumerating recovery success is shown
- **WHEN** a forgot-password request completes
- **THEN** the interface uses non-enumerating confirmation messaging while maintaining design-language consistency

### Requirement: Keep transactional auth copy action-oriented
Authentication pages MUST prioritize concise task-oriented copy and MUST NOT include low-value technical phrasing in primary task flows.

#### Scenario: User performs credential-based sign-in
- **WHEN** the sign-in form is displayed
- **THEN** headings, helper text, and action labels remain concise and focused on the immediate auth task

#### Scenario: User completes password reset
- **WHEN** password reset succeeds
- **THEN** completion messaging is brief, clear, and aligned with the shared product voice
