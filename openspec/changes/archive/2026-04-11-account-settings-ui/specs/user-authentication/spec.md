## MODIFIED Requirements

### Requirement: Align authentication surfaces with shared design language
Sign-in, sign-up, forgot-password, and reset-password screens SHALL use the Sunlit Atelier token, typography, and component hierarchy system. All authenticated nav surfaces SHALL display the user's identity via an initials-circle avatar button, replacing the generic "Profile" label. The initials-circle SHALL open a minimal popover containing Settings and Sign out actions only.

#### Scenario: User opens any authentication route
- **WHEN** a user navigates to an authentication page
- **THEN** the page renders with shared surface, type, input, and action styling defined by the design language

#### Scenario: Auth provider options are rendered
- **WHEN** OAuth provider actions are shown
- **THEN** provider controls use consistent interaction-state styling with other primary and secondary auth actions

#### Scenario: Authenticated user sees initials in topbar
- **WHEN** a signed-in user is on any authenticated page
- **THEN** the topbar displays a circular button containing the user's initials (derived from full name or email)

#### Scenario: Initials button opens minimal popover
- **WHEN** a signed-in user clicks the initials-circle button
- **THEN** a popover appears with two items: "Settings" (navigates to /settings) and "Sign out"

#### Scenario: User signs out via popover
- **WHEN** the user clicks "Sign out" in the topbar popover
- **THEN** the session is revoked and the user is redirected to the marketing landing page
