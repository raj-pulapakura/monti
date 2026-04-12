## ADDED Requirements

### Requirement: Rename experience title from library card overflow menu
The client SHALL allow the user to rename an experience by selecting **Rename** from the `CreationCard` 3-dot overflow menu on the home page. Selecting Rename SHALL navigate to `/chat/:threadId` and immediately activate inline title-edit mode in the sandbox header, reusing the existing title-edit flow.

#### Scenario: Rename selected from library card
- **WHEN** the user selects Rename from a library card's overflow menu
- **THEN** the client navigates to `/chat/:threadId` with title-edit mode pre-activated in the sandbox header

#### Scenario: Title-edit mode activated on arrival
- **WHEN** the user arrives at `/chat/:threadId` via the Rename action
- **THEN** the sandbox header immediately shows the inline title input pre-filled with the current title
