## ADDED Requirements

### Requirement: Show blocking onboarding modal post-signup
The system SHALL display a blocking onboarding modal immediately after a user completes signup, before rendering the main workspace. The modal SHALL NOT be dismissible without completing both questions.

#### Scenario: New user sees modal after signup
- **WHEN** a user successfully completes signup (OAuth or email/password)
- **THEN** the onboarding modal is displayed before the HomeWorkspace renders

#### Scenario: Modal cannot be dismissed
- **WHEN** the onboarding modal is displayed
- **THEN** there is no close button, backdrop click dismiss, or keyboard escape that closes it without completion

### Requirement: Show blocking onboarding modal on first sign-in if not completed
The system SHALL display the onboarding modal on sign-in for any authenticated user whose `onboarding_completed_at` is null.

#### Scenario: Returning user with incomplete onboarding sees modal
- **WHEN** a user signs in AND their `onboarding_completed_at` is null
- **THEN** the onboarding modal is displayed before the HomeWorkspace renders

#### Scenario: User with completed onboarding does not see modal
- **WHEN** a user signs in AND their `onboarding_completed_at` is not null
- **THEN** the HomeWorkspace renders directly without showing the modal

### Requirement: Two-step role and context collection
The onboarding modal SHALL collect two pieces of information in sequence: (1) the user's role, and (2) their context/setting. The user SHALL be able to go back to step 1 from step 2.

#### Scenario: User selects a role on step 1
- **WHEN** the user selects one of: Educator, Tutor, Student, Parent, Learning on my own, Something else
- **THEN** the modal advances to step 2 (context selection)

#### Scenario: User navigates back to step 1
- **WHEN** the user is on step 2 AND clicks the back affordance
- **THEN** the modal returns to step 1 with their previous role selection preserved

#### Scenario: User selects a context on step 2
- **WHEN** the user selects one of: K-12 school, Higher education, Corporate / professional training, Personal use
- **THEN** the system saves the profile and dismisses the modal, revealing the HomeWorkspace

### Requirement: Free-text follow-up for "Something else" role
When the user selects "Something else" on step 1, the modal SHALL display a free-text input for the user to describe their role before advancing.

#### Scenario: User selects "Something else" and enters free text
- **WHEN** the user selects "Something else"
- **THEN** a text input appears inline on step 1 prompting them to describe their role

#### Scenario: Free-text is optional — user can proceed without filling it in
- **WHEN** the user selects "Something else" AND leaves the text input empty
- **THEN** the user can still advance to step 2

### Requirement: Profile save error handling
If the profile save API call fails, the modal SHALL display an error state with a retry affordance. The user SHALL NOT be permanently stuck.

#### Scenario: API error on save
- **WHEN** the user completes step 2 AND the profile save request fails
- **THEN** the modal displays an error message and a "Try again" button

#### Scenario: Retry succeeds
- **WHEN** the user clicks "Try again" AND the retry request succeeds
- **THEN** the modal dismisses and the HomeWorkspace renders
