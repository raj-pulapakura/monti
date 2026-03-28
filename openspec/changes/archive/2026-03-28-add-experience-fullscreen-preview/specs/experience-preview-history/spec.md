## ADDED Requirements

### Requirement: Enter and exit generated experience preview in fullscreen
The client SHALL allow a user to expand an available generated experience to browser fullscreen from the thread workspace while keeping the experience rendered inside the existing sandboxed iframe container and preserving host-controlled exit affordances.

#### Scenario: Enter fullscreen from the preview workspace
- **WHEN** an active experience is available in the thread preview
- **THEN** the client exposes a host-controlled fullscreen action that expands the existing sandbox preview container to browser fullscreen without navigating away from the thread

#### Scenario: Exit fullscreen with browser escape
- **WHEN** the preview is in browser fullscreen and the user presses `Esc`
- **THEN** the client returns the experience to the inline thread preview layout

#### Scenario: Exit fullscreen with host close control
- **WHEN** the preview is in browser fullscreen and the user activates the host-provided close control
- **THEN** the client exits fullscreen without requiring the generated experience to provide its own exit user interface

#### Scenario: Fullscreen keeps preview lifecycle feedback visible
- **WHEN** the preview is fullscreen while the current experience is refreshing or has encountered a preview error
- **THEN** the client continues showing host-owned preview status feedback while preserving the last stable sandboxed experience when one exists
