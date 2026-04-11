# account-settings Specification

## Purpose
Read-only account identity display at `/settings/account`.

## Requirements

### Requirement: Display user account information on /settings/account
The `/settings/account` page SHALL display the authenticated user's email address and their sign-in method (Google or email/password). All fields SHALL be read-only in this phase.

#### Scenario: Email/password user views account page
- **WHEN** an email/password authenticated user navigates to `/settings/account`
- **THEN** the page displays their email address and indicates "Email & password" as the sign-in method

#### Scenario: Google OAuth user views account page
- **WHEN** a Google OAuth authenticated user navigates to `/settings/account`
- **THEN** the page displays their email address and indicates "Google" as the sign-in method

#### Scenario: Account fields are not editable
- **WHEN** the account page renders
- **THEN** all displayed values are presented as read-only text, not interactive form inputs
