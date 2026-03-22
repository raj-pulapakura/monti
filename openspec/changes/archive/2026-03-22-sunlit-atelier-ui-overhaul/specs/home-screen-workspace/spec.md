## ADDED Requirements

### Requirement: Present home workspace with Sunlit Atelier hierarchy
The home workspace SHALL use the shared Sunlit Atelier visual hierarchy for heading treatment, creation input, actions, and creation cards.

#### Scenario: Authenticated user opens home workspace
- **WHEN** an authenticated user loads `/`
- **THEN** the home workspace renders using shared tokenized surfaces, typography roles, and action styling defined by the design language

#### Scenario: Unauthenticated user opens landing view
- **WHEN** an unauthenticated user loads `/`
- **THEN** the marketing landing view uses the same design language primitives and does not introduce a conflicting visual style system

### Requirement: Provide polished thread list state transitions on home
The home workspace SHALL present dedicated loading, empty, and error states for the past-creations region using concise creator-centered language.

#### Scenario: Thread list is loading
- **WHEN** the authenticated home workspace is fetching thread summaries
- **THEN** the interface renders a loading placeholder state for creation cards and clear in-context loading copy

#### Scenario: Thread list is empty
- **WHEN** the authenticated user has no threads
- **THEN** the interface renders an explicit empty state that encourages first creation

#### Scenario: Thread list request fails
- **WHEN** loading the thread list fails
- **THEN** the interface renders a recoverable error state within the home workspace context

### Requirement: Communicate create submission progress with unified controls
The home create form SHALL use shared interaction-state styling and MUST prevent duplicate create submissions while a create request is in flight.

#### Scenario: Create request is submitted
- **WHEN** a user submits a valid non-empty create prompt
- **THEN** the submit control reflects in-progress state using shared loading treatment and prevents duplicate submissions

#### Scenario: Create request fails
- **WHEN** thread creation fails
- **THEN** the interface restores the form to an interactive state and shows a recoverable error message
