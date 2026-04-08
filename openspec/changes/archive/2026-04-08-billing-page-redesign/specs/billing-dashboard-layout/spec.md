## ADDED Requirements

### Requirement: Render billing page with a single full-width stacked layout
The `/billing` page SHALL render all billing content within a single full-width card using a stacked vertical layout. The card SHALL contain four distinct sections in order: plan status row, credit balance stat boxes, credit rate footnote row, and action row. Sections SHALL be visually separated by dividers.

#### Scenario: Billing dashboard renders in stacked layout
- **WHEN** an authenticated user loads `/billing`
- **THEN** the page renders a single full-width card containing plan status, credit balances, rate info, and actions as vertically stacked sections separated by dividers

#### Scenario: No two-column grid is used
- **WHEN** the billing page renders
- **THEN** the layout SHALL NOT use a side-by-side card comparison grid

### Requirement: Display credit balances as stat boxes
The `/billing` page SHALL render each credit pool as a distinct stat box containing a large numeric value and a descriptive label underneath. The stat boxes SHALL be arranged in a horizontal row using CSS grid. The "Included" stat box SHALL use a brand-tinted background to draw visual emphasis. Other stat boxes SHALL use a neutral soft background.

#### Scenario: Free user sees stat boxes for credit balances
- **WHEN** a free-plan user loads `/billing`
- **THEN** the page renders stat boxes for "Included" and "Top-up" credit balances with large numbers and labels

#### Scenario: Paid user sees stat boxes for credit balances
- **WHEN** a paid-plan user loads `/billing`
- **THEN** the page renders stat boxes for "Included" and "Top-up" credit balances with large numbers and labels

#### Scenario: Included credits stat box has brand emphasis
- **WHEN** the credit stat boxes render
- **THEN** the "Included" stat box uses a brand-tinted background, while other stat boxes use a neutral soft background

### Requirement: Conditionally display reserved credits stat box
The `/billing` page SHALL render a "Reserved" stat box when `reservedCreditsTotal` is greater than zero. The reserved stat box SHALL NOT render when the value is zero or null.

#### Scenario: Reserved credits are in flight
- **WHEN** `reservedCreditsTotal` is greater than zero
- **THEN** a third stat box labeled "Reserved" renders alongside the included and top-up stat boxes, showing the reserved count and "in use" label

#### Scenario: No reserved credits
- **WHEN** `reservedCreditsTotal` is zero or null
- **THEN** no reserved credits stat box renders

### Requirement: Display credit costs as a footnote row
The `/billing` page SHALL render fast and quality mode credit costs in a compact footnote-style row below the stat boxes, separated from them by a divider. The row SHALL use muted text styling to distinguish it from primary balance content.

#### Scenario: Credit costs render as footnote
- **WHEN** the billing page renders with cost data
- **THEN** a footnote row below the stat boxes shows "Fast mode uses X credits" and "Quality mode uses X credits" in muted text

### Requirement: Render a plain page heading instead of a hero card
The `/billing` page heading SHALL render as a plain `<h1>` element on the page canvas without a card wrapper, border, box shadow, gradient background, or kicker badge. The page SHALL NOT render a subtitle paragraph below the heading.

#### Scenario: Billing page heading renders as plain text
- **WHEN** an authenticated user loads `/billing`
- **THEN** the page heading renders as plain text without a card wrapper, gradient, shadow, or kicker badge

#### Scenario: No subtitle paragraph renders
- **WHEN** the billing page heading renders
- **THEN** no descriptive subtitle paragraph appears below the heading

### Requirement: Render invoice history as an inline text link
The invoice history action SHALL render as an inline text-styled button with brand color and no border or background fill. It SHALL NOT render as a full secondary button.

#### Scenario: Invoice history renders as text link
- **WHEN** the billing page renders
- **THEN** the invoice history action appears as a text-styled link with brand color and an arrow indicator, not as a bordered button
