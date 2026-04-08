## MODIFIED Requirements

### Requirement: Display version navigation controls in sandbox header
The client SHALL render prev/next chevron buttons and a "vN of M" indicator in the sandbox panel header when more than one succeeded version exists for the active experience. The copy-link button tooltip SHALL reflect whether a pinned or floating URL will be copied based on the currently viewed version.

#### Scenario: Version nav shown when multiple versions exist
- **WHEN** the sandbox state has an active experience with two or more succeeded versions
- **THEN** the sandbox header shows a previous-version button, a "vN of M" label, and a next-version button

#### Scenario: Version nav hidden when only one version exists
- **WHEN** the sandbox state has an active experience with exactly one succeeded version
- **THEN** no version navigation controls are rendered

#### Scenario: Previous button disabled on first version
- **WHEN** the user is viewing version 1
- **THEN** the previous-version button is visually disabled and not interactive

#### Scenario: Next button disabled on latest version
- **WHEN** the user is viewing the most recent version
- **THEN** the next-version button is visually disabled and not interactive

#### Scenario: Prompt summary visible on version indicator hover
- **WHEN** the user hovers over the "vN of M" indicator
- **THEN** a tooltip shows the `promptSummary` for the currently viewed version

#### Scenario: Copy link tooltip shows pinned version when viewing non-latest
- **WHEN** the user is viewing a non-latest version via version navigation
- **THEN** the copy-link button tooltip reads "Copy link to v*N*"

#### Scenario: Copy link tooltip is generic when on latest version
- **WHEN** the user is on the latest version (default state or navigated back to latest)
- **THEN** the copy-link button tooltip reads "Copy link"
