## 1. CSS Foundation

- [x] 1.1 Add `.billing-heading` styles — plain h1 on canvas, no card/border/shadow/gradient, no kicker
- [x] 1.2 Add `.billing-card` styles — single full-width card with border, radius, padding, and internal vertical gap
- [x] 1.3 Add `.billing-divider` styles — subtle horizontal rule between card sections
- [x] 1.4 Add `.billing-plan-row` styles — horizontal layout with plan label on left, date on right
- [x] 1.5 Add `.billing-stats` styles — CSS grid row with `auto-fit` and ~140px min column width for stat boxes
- [x] 1.6 Add `.billing-stat` styles — stat box with large number (~1.6-1.8rem bold), label underneath in muted text, soft background, border-radius
- [x] 1.7 Add `.billing-stat.is-primary` modifier — brand-soft background tint for the included credits box
- [x] 1.8 Add `.billing-rate-row` styles — compact footnote row with muted text for credit costs
- [x] 1.9 Add `.billing-actions` styles — flex row for action buttons with space-between alignment
- [x] 1.10 Add `.billing-text-link` styles — text-styled button with brand color, no border/background, arrow indicator, hover underline

## 2. Page Structure Rewrite

- [x] 2.1 Replace `.pricing-hero` hero section with a plain `<h1>` using `.billing-heading` — remove kicker badge and subtitle paragraph
- [x] 2.2 Replace the `.pricing-grid` two-column layout with a single `.billing-card` wrapper
- [x] 2.3 Add plan status row inside the card — plan label left, refresh/period date right, using `.billing-plan-row`
- [x] 2.4 Replace the credits `<ul>` list with `.billing-stats` grid containing stat boxes for included and top-up credits
- [x] 2.5 Add conditional reserved credits stat box — render only when `reservedCreditsTotal > 0`
- [x] 2.6 Add credit costs footnote row using `.billing-rate-row` — "Fast mode uses X credits · Quality mode uses X credits"
- [x] 2.7 Restructure action row — primary CTA (upgrade/topup) as `landing-primary`, manage subscription as `landing-secondary`, invoice history as `.billing-text-link`
- [x] 2.8 Update the loading skeleton to match the new single-card layout

## 3. Verification

- [x] 3.1 Verify free-plan view — stat boxes show included/top-up, upgrade button is primary CTA, invoice history is text link, no topup button
- [x] 3.2 Verify paid-plan view — stat boxes show included/top-up, topup button + manage subscription + invoice history text link all render
- [x] 3.3 Verify reserved credits appear/disappear based on `reservedCreditsTotal` value
- [x] 3.4 Verify stat boxes wrap gracefully on narrow viewports (mobile)
- [x] 3.5 Verify error state and loading state still function correctly
