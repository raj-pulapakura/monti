## ADDED Requirements

### Requirement: Render live experience preview in creation card thumbnail
The system SHALL render each creation card thumbnail as a sandboxed iframe showing the actual experience HTML/CSS/JS, scaled down to fit the card dimensions.

#### Scenario: Thread has experience content
- **WHEN** a `ThreadCard` has non-null `experienceHtml`, `experienceCss`, and `experienceJs`
- **THEN** the card thumbnail renders a sandboxed iframe with `srcdoc` built from those fields, scaled via CSS transform to fill the thumbnail area

#### Scenario: Thread has no experience content
- **WHEN** a `ThreadCard` has null experience content (sandbox never reached ready state)
- **THEN** the card thumbnail renders a styled empty-state placeholder instead of an iframe

#### Scenario: Iframe does not intercept card interaction
- **WHEN** the user clicks a creation card containing a live preview iframe
- **THEN** the click propagates to the card button and navigates to `/chat/<threadId>`, because the iframe has `pointer-events: none`

### Requirement: Isolate iframe preview execution
The system SHALL render creation card iframes with `sandbox="allow-scripts"` to prevent navigation, popups, and cross-origin credential access.

#### Scenario: Experience script attempts to navigate top frame
- **WHEN** an experience JS calls `window.top.location = '...'` or similar
- **THEN** the sandbox attribute blocks the navigation attempt and the parent page is unaffected

### Requirement: Thread list API includes latest experience version content
The system SHALL return `experienceHtml`, `experienceCss`, and `experienceJs` fields per thread in the thread list response, sourced from the thread's current `experience_version_id`.

#### Scenario: Thread has a ready sandbox with experience version
- **WHEN** the thread list endpoint processes a thread whose sandbox state has a non-null `experience_version_id`
- **THEN** the response includes the corresponding `html`, `css`, and `js` from `experience_versions`

#### Scenario: Thread has no experience version
- **WHEN** a thread's sandbox state has a null `experience_version_id`
- **THEN** `experienceHtml`, `experienceCss`, and `experienceJs` are null in the response
