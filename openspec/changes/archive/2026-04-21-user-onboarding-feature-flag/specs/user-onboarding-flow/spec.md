## ADDED Requirements

### Requirement: Configuration disables blocking user onboarding on home

The system SHALL honor a client-visible configuration flag that turns off the blocking onboarding experience for the authenticated home route on `/`. When user onboarding is disabled by that configuration, the system SHALL render the HomeWorkspace for authenticated users after a successful profile fetch, even when no `user_profiles` row exists or `onboarding_completed_at` is null. When user onboarding is disabled, a failed profile fetch SHALL NOT render the HomeWorkspace until the user succeeds with retry or leaves the authenticated home path by signing out.

#### Scenario: Incomplete profile skips blocking modal when onboarding is disabled

- **WHEN** user onboarding is disabled by configuration AND an authenticated user’s profile fetch completes successfully with no profile or with null `onboarding_completed_at`
- **THEN** the HomeWorkspace renders without the onboarding modal

#### Scenario: Profile fetch error does not open workspace when onboarding is disabled

- **WHEN** user onboarding is disabled by configuration AND the profile fetch ends in an error state on the authenticated home route
- **THEN** the HomeWorkspace does not render and the user is offered recovery consistent with the existing error path (e.g. retry)

#### Scenario: Default configuration preserves blocking onboarding

- **WHEN** the disabling configuration is unset or not in the disabled state AND an authenticated user’s profile fetch completes successfully with no profile or null `onboarding_completed_at`
- **THEN** the onboarding modal is shown before the HomeWorkspace per the existing requirements for the enabled path
