## Why

The current landing page fails to communicate what Monti does. It shows no product output, uses vague feature labels ("Conversation Studio", "Live Preview Loop"), and provides no reason for an educator to believe this tool is for them. With launch approaching, the landing page is the primary conversion surface and needs to earn a sign-up within 60 seconds of arrival.

The target audience has been defined: **independent educators** — classroom teachers, tutors, homeschooling parents, and online course creators. The copy and structure need to be rebuilt from scratch around this audience, grounded in the Monti experience philosophy.

## What Changes

- **Replace the entire marketing landing page** with a new 6-section structure: Hero, Show Don't Tell (example experiences), How It Works (3-step flow), Who It's For (educator personas), Pricing, and Final CTA.
- **New headline and copy direction** targeting educators: "Make learning something they *do*" as the anchor, with all copy speaking to people who teach.
- **Add interactive/visual showcase section** with 2-3 curated Monti experiences that visitors can see or try — the single biggest gap in the current page.
- **Redesign pricing section copy** from "Simple credits that scale with your classroom" to a lower-friction framing. Pricing data still sourced from the shared contract.
- **Drop "classroom" framing** across all landing copy in favor of inclusive "anyone who teaches" language.
- **Add asset placeholders** for hero screen recording, example experiences, and step visuals that the user will supply.

## Capabilities

### New Capabilities
- `educator-landing-experience`: Defines the marketing landing page structure, section hierarchy, copy strategy, visual layout, and educator-targeted messaging for the unauthenticated root route.

### Modified Capabilities
- `public-pricing-funnel`: The pricing section copy and visual treatment change (header, plan card descriptions), though the underlying data contract and routing logic remain the same.

## Impact

- **Web frontend**: `web/app/page.tsx` — the `MarketingLanding` component and all landing-specific CSS in `globals.css` (`.landing-*` classes) will be rewritten.
- **Design tokens**: No new tokens required. The existing Sunlit Atelier palette, typography, and motion tokens are retained.
- **Backend**: No backend changes. Pricing data contract unchanged.
- **Assets**: Requires user-supplied assets (hero recording, showcase experiences, step visuals) — placeholders used until available.
