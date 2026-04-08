## Context

The `/billing` page (`web/app/billing/page.tsx`) currently reuses the `.pricing-shell` / `.pricing-grid` / `.pricing-plan` CSS classes from the public `/pricing` page. This produces a two-column card comparison layout that makes sense for marketing (compare Free vs Paid) but is wrong for an authenticated account dashboard where the user already has a plan and just wants to see their balance.

The page consumes `GET /api/billing/me` which returns `BillingMeData` including `includedCreditsAvailable`, `topupCreditsAvailable`, `reservedCreditsTotal`, and `costs` (fast/quality credit rates). The `reservedCreditsTotal` field is currently unused in the UI.

All styling uses vanilla CSS classes in `web/app/globals.css` against the app's semantic token system (surfaces, content, borders, brand, elevation, radius, motion).

## Goals / Non-Goals

**Goals:**
- Make the billing page feel like a personal account dashboard, not a pricing comparison
- Make credit balances the visual centerpiece — glanceable at a glance
- Fix the orphaned "Invoice history" button on free plans
- Surface reserved credits when they exist
- Separate credit balances (what you have) from rate info (what things cost)
- Strip the hero down to a plain page heading

**Non-Goals:**
- Changing the `/pricing` page — its two-column grid layout is correct for its purpose
- Modifying the billing API or backend — all needed data is already served
- Adding credit usage history, charts, or analytics
- Dark mode or responsive breakpoint overhaul (existing responsive behavior carries over)

## Decisions

### 1. Single full-width card instead of two-column grid

The billing page will use a single card spanning full width, with internal sections separated by dividers. Plan status sits at the top as a compact header row, credit stat boxes fill the middle, rate info and actions sit at the bottom.

**Why over two columns:** The two-column layout creates an implicit comparison between plan and credits. On a dashboard, these are sections of one story (your account), not competing items. A single card also avoids the asymmetry problem where the plan card has much less content than the credits card.

### 2. New CSS class namespace: `.billing-*`

The billing page will use its own class namespace (`.billing-dashboard`, `.billing-stat`, `.billing-rate-row`, `.billing-actions`, etc.) instead of reusing `.pricing-*` classes.

**Why not reuse `.pricing-*`:** The pricing page and billing page have fundamentally different layouts now. Coupling them through shared classes means changes to one risk breaking the other. Clean separation. The `.pricing-*` classes remain untouched for `/pricing`.

### 3. Stat boxes for credit balances

Each credit pool renders as a stat box: a container with the number displayed large (~1.6-1.8rem, bold, `--content-strong`) and a label underneath in `--content-muted`. The boxes sit in a horizontal row using CSS grid with `auto-fit` to handle 2 or 3 boxes gracefully.

The "Included" stat box gets a subtle `--brand-soft` background tint to draw the eye to the primary balance. Top-up and reserved boxes use `--surface-soft`.

**Why boxes over inline stats:** Boxes create clear visual separation between pools and give the numbers enough space to be genuinely glanceable. An inline `45 included · 0 top-up` row compresses too much for the page's main content.

### 4. Conditional reserved credits rendering

The reserved credits stat box only renders when `reservedCreditsTotal > 0`. Zero reserved is the normal resting state and would just add noise.

**Why conditional:** Unlike included/top-up credits where zero is meaningful information ("you have no credits"), zero reserved credits means "nothing is happening right now" — not actionable.

### 5. Invoice history as inline text link

"Invoice history" becomes a text-styled action (`<button>` with text-link styling: brand color, no border, no background, arrow suffix) instead of a `landing-secondary` button.

**Why:** On free plans there's no sibling CTA (no topup button), so a full button looks orphaned. A text link is visually appropriate for a tertiary action and works well whether it's alone (free) or paired with the topup button (paid).

### 6. Plain page heading instead of hero card

The `.pricing-hero` card wrapper is replaced with a simple heading — just an `<h1>` sitting on the canvas background with no border, shadow, gradient, or kicker badge. The subtitle paragraph is also removed.

**Why:** The hero card treatment is appropriate for marketing/landing pages where you need to set a mood. The billing page is utilitarian — you're here to check your balance. The content card below becomes the visual anchor.

### 7. Rate info as a footnote row

Credit costs (fast mode: X credits, quality mode: X credits) render in a compact row below the stat boxes, separated by a divider. Small text, `--content-muted`, with a dot separator. This is reference material, not primary content.

## Risks / Trade-offs

- **Visual consistency with pricing page** — The billing and pricing pages will now look quite different from each other. This is intentional (different purposes → different layouts), but if a user bounces between them, the visual shift is noticeable. → *Mitigation:* Shared token system and button styles maintain brand consistency even though layout differs.

- **Stat box layout at narrow widths** — Three stat boxes in a row may compress too much on small screens. → *Mitigation:* Use `auto-fit` with a min column width (~140px) so boxes wrap to two rows on narrow viewports. Existing `.pricing-grid` mobile breakpoint logic provides a pattern.

- **Reserved credits appearing/disappearing** — The conditional third stat box means the layout shifts between 2 and 3 columns based on runtime state. → *Mitigation:* CSS grid `auto-fit` handles this naturally. The shift only occurs when a generation is in flight, which is a transient state the user is aware of.
