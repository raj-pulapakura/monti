## ADDED Requirements

### Requirement: Offer rotating example prompt starters on authenticated home

The authenticated home workspace SHALL display exactly three clickable example prompt controls adjacent to the primary create input. The visible prompts SHALL be selected from a client-defined pool larger than three using a deterministic algorithm that depends on the signed-in user’s stable identifier and the current calendar day in UTC, such that the same user sees the same three prompts for the entire UTC day and may see different prompts on a subsequent UTC day. The controls SHALL be visible whenever the authenticated home workspace is shown, without requiring an empty thread list or first-time visit.

#### Scenario: Authenticated user sees three starters

- **WHEN** an authenticated user loads the home workspace
- **THEN** the interface renders exactly three example prompt controls near the create input

#### Scenario: Clicking a starter fills the create input

- **WHEN** an authenticated user activates one of the example prompt controls
- **THEN** the create textarea is set to that prompt’s full text and is focused or otherwise ready for the user to edit or submit

#### Scenario: Starters do not submit the create form by themselves

- **WHEN** an authenticated user activates an example prompt control
- **THEN** the system does not submit the create form solely as a result of that activation

#### Scenario: Deterministic rotation within a UTC day

- **WHEN** the same authenticated user reloads or revisits the home workspace multiple times within the same UTC calendar day
- **THEN** the same three example prompts are shown each time (assuming the same pool version in the deployed client)

#### Scenario: Starters are not shown on unauthenticated landing

- **WHEN** a visitor without a valid session views the marketing landing on `/`
- **THEN** the example prompt starter controls for the authenticated home create flow are not shown

### Requirement: Style example prompt starters with Sunlit Atelier

Example prompt controls SHALL use the same design language tokens and hierarchy as the home create region (surfaces, typography, focus rings) and SHALL not introduce a conflicting control style.

#### Scenario: Authenticated home shows starters

- **WHEN** the authenticated home workspace renders the example prompt controls
- **THEN** their visual treatment is consistent with Sunlit Atelier patterns used by the home create form
