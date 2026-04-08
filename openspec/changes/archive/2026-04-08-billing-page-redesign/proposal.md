## Why

The `/billing` page currently uses a two-column pricing grid layout borrowed from the public pricing page, which makes it feel like a generic SaaS comparison table rather than a personal account dashboard. Credit balances are rendered as an unstyled `<ul>` bullet list with no visual hierarchy. The plan card is sparse and hollow next to the denser credits card. The hero section uses a full card with radial gradients and box shadows — marketing-page energy on an account page. On the free plan, the "Invoice history" button sits alone without its intended sibling CTA, looking stranded. The `reservedCreditsTotal` field from the billing API is available but completely hidden from users.

## What Changes

- **Replace the two-column pricing grid with a single full-width stacked layout** — plan status, credit balances, rate info, and actions flow top-to-bottom in one cohesive card instead of competing side-by-side cards.
- **Replace the hero card with a plain page heading** — remove the border, gradient background, box shadow, and kicker badge. The billing page title becomes simple text on the canvas, not a marketing banner.
- **Replace the credit `<ul>` list with stat boxes** — each credit pool (included, top-up, and conditionally reserved) gets its own visually distinct stat box with a large number and label underneath.
- **Surface `reservedCreditsTotal`** — show reserved/in-flight credits as a third stat box, but only when the value is greater than zero.
- **Demote "Invoice history" to a text link** — style it as an inline text action (brand color, arrow) instead of a full `landing-secondary` button, solving the lone-button problem on free plans.
- **Separate credit balances from rate info** — credit costs (fast/quality) move to a distinct footnote-style row below the stat boxes, clearly positioned as reference material rather than a balance.
- **Remove the hero subtitle paragraph** — the stat boxes make the page purpose self-evident; "Track available credits, view current costs..." adds no value.

## Capabilities

### New Capabilities

- `billing-dashboard-layout`: Full-width stacked billing page layout with stat boxes for credit balances, plain page heading, and restructured action hierarchy.

### Modified Capabilities

- `authenticated-billing-workspace`: Requirements change for how credit balances are displayed (stat boxes instead of list), how the hero is rendered (plain heading instead of card), how invoice history is accessed (text link instead of button), and surfacing `reservedCreditsTotal` conditionally.

## Impact

- **Frontend**: `web/app/billing/page.tsx` — full rewrite of the JSX structure and class usage.
- **Styles**: `web/app/globals.css` — new CSS classes for the billing dashboard layout (stat boxes, plain heading, rate row, text-link action). Existing `.pricing-*` classes remain for the `/pricing` page but are no longer used on `/billing`.
- **Backend**: No changes. The `GET /api/billing/me` response already includes all needed fields (`reservedCreditsTotal`, `includedCreditsAvailable`, `topupCreditsAvailable`, `costs`).
- **API contract**: No changes.
