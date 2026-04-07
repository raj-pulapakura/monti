## Context

The unauthenticated root route (`/`) currently renders a `MarketingLanding` component inside `web/app/page.tsx` (lines 428-507). It contains three sections: a hero with a vague headline, three feature cards with internal product jargon, and a pricing grid. There are no product visuals, no example outputs, no user personas, and no demonstration of what Monti actually creates.

The existing Sunlit Atelier design language (warm cream/terracotta palette, Manrope + Cormorant Garamond typography, semantic CSS custom properties) is retained. All landing styles live in `web/app/globals.css` under `.landing-*` classes.

The page shares `web/app/page.tsx` with the authenticated `HomeWorkspace` component — the route is session-aware and renders one or the other.

## Goals / Non-Goals

**Goals:**
- Replace the `MarketingLanding` component with a new 6-section structure that communicates what Monti does within 60 seconds
- Ground all copy in the educator audience and the Monti experience philosophy
- Include an interactive or visual showcase of real Monti experience outputs
- Keep pricing data sourced from the shared billing contract (no hardcoded copy drift)
- Use asset placeholders where user-supplied media is needed

**Non-Goals:**
- Changing authenticated routes (HomeWorkspace, chat, pricing page)
- Adding new design tokens or fonts — the Sunlit Atelier system is sufficient
- Building a CMS or dynamic content system for landing copy
- A/B testing infrastructure
- Mobile app landing pages or platform-specific variants
- Changing the routing architecture (`/` remains session-aware)

## Decisions

### 1. Extract MarketingLanding into its own file

**Decision:** Move the landing page from `web/app/page.tsx` into a dedicated `web/app/components/marketing-landing.tsx` component.

**Why:** The current file mixes authenticated workspace logic with marketing markup. Separating them makes the landing page independently editable without risk to the authenticated flow. `page.tsx` retains the session check and renders either component.

**Alternative considered:** Keep everything in `page.tsx`. Rejected because the new landing page is substantially larger (6 sections vs 3) and mixing it with HomeWorkspace makes the file unwieldy.

### 2. Inline section components, no over-abstraction

**Decision:** Each of the 6 sections is a block of JSX within `MarketingLanding`. No separate component file per section.

**Why:** These sections are rendered once, have no shared state, and aren't reused elsewhere. Extracting them into separate files adds indirection with zero reuse benefit. If a section grows complex enough to warrant extraction later, it can be done then.

### 3. Showcase section uses static asset placeholders initially

**Decision:** The "Show, don't tell" section renders 2-3 cards with placeholder images/thumbnails. Each card includes a topic label, audience tag, and a screenshot placeholder. Interactive iframe embeds are deferred.

**Why:** The user needs to curate and generate showcase experiences before they can be embedded. Blocking the landing page rebuild on asset creation delays everything. Placeholders let us ship the structure and copy, then swap in real assets.

**Future path:** Once assets are ready, each card gains a `Try it` button that opens the experience in an inline sandboxed iframe or a modal — same sandbox approach used in the chat preview.

### 4. Pricing section reads from shared constants

**Decision:** Pricing values (credit amounts, costs, plan names) continue to be sourced from the shared pricing contract, same as the current implementation. Only the surrounding copy and layout change.

**Why:** The `public-pricing-funnel` spec requires pricing surfaces to stay aligned with the active billing contract. Hardcoding new copy would violate this.

### 5. Replace all landing CSS classes

**Decision:** Delete existing `.landing-*` styles in `globals.css` and write new ones for the rebuilt sections. Class naming follows the same pattern (`.landing-hero`, `.landing-showcase`, `.landing-steps`, etc.).

**Why:** The current CSS is tightly coupled to the 3-section layout. Patching it to support 6 sections with different layouts (full-width asymmetric, card grids, persona cards) would be messier than a clean rewrite of the landing-specific styles.

### 6. Display typography treatment

**Decision:** The hero headline uses Cormorant Garamond italic (`.display-script`) on the emphasized word "do" — same technique currently used for "wow". Section kickers use the existing `.landing-kicker` badge style.

**Why:** Maintains visual continuity with the design language while shifting the copy emphasis from a generic adjective ("wow") to an active verb ("do") that echoes the philosophy.

## Risks / Trade-offs

**[Placeholder assets delay full impact]** → The showcase section is the most important part of the page, but ships with placeholders. Mitigation: structure and copy still land; assets can be swapped without code changes.

**[Copy may need iteration post-launch]** → Landing page copy is a hypothesis until real users see it. Mitigation: all copy is in a single component file, easy to update. No copy is split across backend/frontend.

**[Pricing section copy change is cosmetic only]** → Changing "Simple credits that scale with your classroom" to new copy doesn't affect the data contract, but the visual layout change could introduce inconsistency with `/pricing` page. Mitigation: the `/pricing` page is out of scope — this change only touches the landing pricing summary.
