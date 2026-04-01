## ADDED Requirements

### Requirement: Provide a billing navigation entry point in profile controls
The `FloatingProfileControls` component SHALL include a "Billing & plan" navigation item that links authenticated users to `/pricing`. The item MUST appear in the profile dropdown menu alongside the existing sign-out action. This entry point is the primary in-product path for authenticated users to view pricing, upgrade their plan, or access billing management until a dedicated billing workspace exists.

#### Scenario: Authenticated user opens profile menu
- **WHEN** an authenticated user opens the profile dropdown in the home workspace or chat view
- **THEN** the menu includes a "Billing & plan" item linking to `/pricing`

#### Scenario: User navigates to pricing from profile menu
- **WHEN** an authenticated user selects "Billing & plan" from the profile dropdown
- **THEN** the system navigates to `/pricing` and the pricing page renders with auth-aware CTAs appropriate for their current plan state
