## ADDED Requirements

### Requirement: Define a unified Sunlit Atelier token system
The web application SHALL expose a shared semantic token system for surface, content, border, brand, state, elevation, and motion values and SHALL consume those tokens across marketing, home workspace, chat runtime, sandbox preview, and auth routes.

#### Scenario: Shared tokens are used across first-party routes
- **WHEN** a user navigates between marketing, home, chat, and auth screens
- **THEN** those screens use the same semantic token contract for color, elevation, and spacing instead of route-local raw values

#### Scenario: Primary actions remain visually consistent
- **WHEN** a primary action is rendered on any first-party route
- **THEN** it uses the shared brand-action token family and interaction states defined by the design language

### Requirement: Enforce dual-type typography roles
The system SHALL use a sans-serif type role for body, controls, forms, and status text and SHALL restrict cursive typography to display-emphasis contexts.

#### Scenario: Functional UI text remains high-legibility
- **WHEN** labels, inputs, buttons, helper text, messages, and status elements are rendered
- **THEN** the system uses the sans-serif type role rather than cursive display styling

#### Scenario: Display emphasis uses constrained cursive usage
- **WHEN** hero or section-emphasis text is rendered
- **THEN** cursive styling is applied only to designated display-emphasis elements and not to transactional form or status content

### Requirement: Standardize state-feedback presentation patterns
The system SHALL provide shared visual and copy patterns for loading, empty, success, warning/error, and connectivity feedback states.

#### Scenario: Immediate feedback is shown after user action
- **WHEN** a user triggers an asynchronous action
- **THEN** the interface shows immediate state feedback within the initiating surface

#### Scenario: Long-running operations provide progressive feedback
- **WHEN** an operation remains in progress beyond instant response windows
- **THEN** the interface presents progressive, human-readable status messaging instead of static or ambiguous waiting text

#### Scenario: Error states provide recovery guidance
- **WHEN** an operation fails on any first-party route
- **THEN** the interface shows a consistent error pattern with actionable recovery guidance
