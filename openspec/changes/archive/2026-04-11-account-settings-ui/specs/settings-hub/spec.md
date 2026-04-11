## ADDED Requirements

### Requirement: Render a settings hub at /settings with sidebar navigation
The system SHALL provide a `/settings` route that renders a two-column layout: a persistent left sidebar with navigation links and a right content area that renders the active sub-page. The sidebar SHALL contain links to Account (`/settings/account`) and Billing (`/settings/billing`).

#### Scenario: User navigates to /settings
- **WHEN** an authenticated user navigates to `/settings`
- **THEN** the settings layout renders with a sidebar showing Account and Billing links, and the default sub-page content is displayed

#### Scenario: User navigates to a settings sub-page directly
- **WHEN** an authenticated user navigates to `/settings/account` or `/settings/billing`
- **THEN** the settings layout renders with the sidebar and the corresponding sub-page content in the right panel

#### Scenario: Active sidebar link is highlighted
- **WHEN** the user is on `/settings/account`
- **THEN** the Account sidebar link appears in an active/selected state; the Billing link does not

#### Scenario: Unauthenticated user visits /settings
- **WHEN** an unauthenticated user navigates to any `/settings/*` route
- **THEN** the system redirects to `/sign-in?next=/settings/account` (or the appropriate sub-page path)

### Requirement: Settings sidebar collapses on mobile
The settings sidebar SHALL stack above the content area on small viewports rather than rendering side-by-side.

#### Scenario: Settings page renders on a narrow viewport
- **WHEN** the settings page renders on a viewport narrower than the desktop breakpoint
- **THEN** the sidebar links appear above the content area in a horizontal or stacked compact form
