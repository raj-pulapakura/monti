## ADDED Requirements

### Requirement: Display and edit user profile on /settings/account
The `/settings/account` page SHALL display the user's current role and context selections with the ability to update them. Changes SHALL be saved via the profile API.

#### Scenario: User with completed onboarding views profile section
- **WHEN** an authenticated user with a completed profile navigates to `/settings/account`
- **THEN** the page displays their current role and context with an edit affordance

#### Scenario: User updates their role
- **WHEN** the user changes their role selection and saves
- **THEN** the profile is updated via the PATCH endpoint and the page reflects the new value

#### Scenario: User updates their context
- **WHEN** the user changes their context selection and saves
- **THEN** the profile is updated via the PATCH endpoint and the page reflects the new value

#### Scenario: User with no profile sees prompt to complete onboarding
- **WHEN** an authenticated user with null onboarding_completed_at navigates to `/settings/account`
- **THEN** the profile section shows a prompt to complete onboarding rather than empty fields
