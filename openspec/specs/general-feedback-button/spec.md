# general-feedback-button Specification

## Purpose

Authenticated users can send general product feedback from a floating control available across app pages.

## Requirements

### Requirement: Floating button renders on authenticated pages only

The system SHALL render the floating feedback button on all pages where the user is authenticated. The button SHALL NOT render on unauthenticated pages (sign-in, sign-up, public pricing, etc.). The component SHALL self-check for an active session and render nothing if no session is found.

#### Scenario: Authenticated user sees the button

- **WHEN** a user with an active session visits any authenticated page
- **THEN** the floating feedback button is visible in the bottom-right corner of the viewport

#### Scenario: Unauthenticated user does not see the button

- **WHEN** a user without an active session visits any page
- **THEN** the floating feedback button is not rendered

### Requirement: Feedback surface opens on button click

The system SHALL expand a feedback surface when the user clicks the floating button. The surface SHALL contain a text input area and a submit button. The surface SHALL close when the user submits or explicitly dismisses it.

#### Scenario: User opens the feedback surface

- **WHEN** the user clicks the floating feedback button
- **THEN** a feedback surface expands with a text area and submit button visible

#### Scenario: User dismisses the feedback surface without submitting

- **WHEN** the user clicks outside the surface or a close/dismiss control
- **THEN** the feedback surface collapses and any typed text is discarded

### Requirement: General feedback is submitted and persisted

The system SHALL submit the user's free-text message to `POST /api/feedback` with `kind: 'general'` when the user clicks submit. The system SHALL disable the submit button while the request is in flight. On success the surface SHALL close. On failure the surface SHALL display an error and remain open.

#### Scenario: Successful submission

- **WHEN** the user types a message and clicks submit
- **THEN** the request is sent with `{ kind: 'general', message: <text> }`, the surface closes on success, and a new feedback row is created

#### Scenario: Empty submission is blocked

- **WHEN** the user clicks submit with an empty or whitespace-only message
- **THEN** the request is NOT sent and the submit button remains disabled

#### Scenario: Failed submission shows error

- **WHEN** the backend returns an error or the request fails
- **THEN** the surface remains open and an error message is shown to the user
