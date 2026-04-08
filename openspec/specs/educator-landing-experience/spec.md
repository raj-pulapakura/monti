## ADDED Requirements

### Requirement: Present educator-targeted hero section at the top of the landing page
The marketing landing page SHALL display a hero section with a headline, subline, and call-to-action that speaks directly to educators. The headline SHALL communicate that Monti turns ideas into interactive learning experiences. The subline SHALL clarify the workflow (describe → generate → refine) and that no coding is required. The hero section SHALL include a primary CTA linking to sign-up and a secondary CTA that scrolls to the showcase section.

#### Scenario: Visitor sees the hero section on page load
- **WHEN** an unauthenticated visitor opens the root route
- **THEN** the hero section is visible above the fold with a headline, subline, primary CTA ("Get started free"), and secondary CTA ("See it in action")

#### Scenario: Hero includes a visual asset area
- **WHEN** the hero section renders
- **THEN** it includes a designated area for a product visual (screen recording or screenshot of the creation flow), which displays a placeholder until the final asset is supplied

### Requirement: Showcase real Monti experience outputs in a dedicated section
The landing page SHALL include a "Show, don't tell" section that displays 2-3 curated example experiences with topic labels, short descriptive copy (who it is for and what kind of interaction it is), and visual previews. This section SHALL demonstrate the concrete output of Monti to visitors who have never seen the product.

#### Scenario: Visitor sees example experience cards
- **WHEN** a visitor scrolls to the showcase section
- **THEN** the page displays 2-3 example cards, each showing a topic label (e.g. "Photosynthesis"), brief copy that signals learner level and interaction style (e.g. "Middle school · game-like practice"), and a visual preview area

#### Scenario: Showcase uses placeholders when assets are not yet supplied
- **WHEN** final experience assets have not been provided
- **THEN** each card renders a styled placeholder in the visual preview area rather than a broken or empty state

### Requirement: Explain the creation workflow in a 3-step section
The landing page SHALL include a "How it works" section that presents the Monti workflow as three sequential steps: Describe, Refine, and Share. Each step SHALL have a short label, a brief description, and a placeholder area for a supporting visual.

#### Scenario: Visitor sees the 3-step workflow
- **WHEN** a visitor scrolls to the "How it works" section
- **THEN** three steps are displayed in order: (1) Describe your idea, (2) Refine in conversation, (3) Share with learners, each with descriptive copy and a visual placeholder

### Requirement: Present educator personas in a "Who it's for" section
The landing page SHALL include a section that identifies the target audience with 2-3 educator persona cards. Each card SHALL include a persona label and a representative quote that helps the visitor recognize themselves.

#### Scenario: Visitor sees educator persona cards
- **WHEN** a visitor scrolls to the "Who it's for" section
- **THEN** the page displays persona cards for at minimum: classroom teachers, tutors, and parents — each with a label and a scenario quote

### Requirement: Include a final call-to-action section above the footer
The landing page SHALL end with a closing CTA section that includes a short motivating headline and a primary sign-up button.

#### Scenario: Visitor sees the closing CTA
- **WHEN** a visitor scrolls to the bottom of the landing page
- **THEN** a final section displays a headline and a primary "Get started free" CTA linking to sign-up

### Requirement: Use educator-inclusive language across all landing copy
All landing page copy SHALL use inclusive language that addresses "anyone who teaches" rather than narrowing to institutional classroom contexts. The word "classroom" SHALL NOT appear in landing page headlines or section headers.

#### Scenario: Landing copy avoids classroom-specific framing
- **WHEN** the landing page renders any headline or section header
- **THEN** the text uses educator-inclusive terms (e.g. "learners", "teaching", "lesson") rather than institution-specific terms (e.g. "classroom", "school", "district")
