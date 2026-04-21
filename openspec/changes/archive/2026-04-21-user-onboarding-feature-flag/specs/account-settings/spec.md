## MODIFIED Requirements

### Requirement: Display and edit user profile on /settings/account

The `/settings/account` page SHALL display the user's current role and context selections with the ability to update them. Changes SHALL be saved via the profile API. When user onboarding is enabled by configuration (including when the disabling configuration is unset), the profile section SHALL use onboarding-oriented prompts for users who have no profile or null `onboarding_completed_at` as specified in the scenarios below. When user onboarding is disabled by configuration, the profile section SHALL NOT display copy that states the user will be blocked or specifically prompted on the home screen to complete onboarding, or that the full workspace is locked until onboarding is completed; it SHALL instead use neutral learning-profile messaging or editing affordances.

#### Scenario: User with completed onboarding views profile section

- **WHEN** an authenticated user with a completed profile navigates to `/settings/account`
- **THEN** the page displays their current role and context with an edit affordance

#### Scenario: User updates their role

- **WHEN** the user changes their role selection and saves
- **THEN** the profile is updated via the PATCH endpoint and the page reflects the new value

#### Scenario: User updates their context

- **WHEN** the user changes their context selection and saves
- **THEN** the profile is updated via the PATCH endpoint and the page reflects the new value

#### Scenario: User with no profile or incomplete onboarding sees onboarding prompt when home onboarding is enabled

- **WHEN** user onboarding is enabled by configuration AND an authenticated user has no profile or has null `onboarding_completed_at` AND navigates to `/settings/account`
- **THEN** the profile section shows a prompt to complete onboarding rather than empty fields

#### Scenario: User with no profile sees neutral learning-profile guidance when onboarding is disabled

- **WHEN** user onboarding is disabled by configuration AND an authenticated user has no profile AND profile fetch is ready AND navigates to `/settings/account`
- **THEN** the profile section does not state they will be prompted on the home screen, and presents neutral guidance or controls to add a learning profile

#### Scenario: User with incomplete onboarding sees no workspace-lock messaging when onboarding is disabled

- **WHEN** user onboarding is disabled by configuration AND an authenticated user has a profile with null `onboarding_completed_at` AND profile fetch is ready AND navigates to `/settings/account`
- **THEN** the profile section does not claim the full workspace is locked behind completing onboarding
