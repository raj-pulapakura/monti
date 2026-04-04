## Why

Signed-in creators land on home with a blank create input; a small set of **clickable example prompts** lowers activation friction and shows what Monti is good for. Showing the **same three strings forever** feels stale, so we surface **three at a time** from a **larger rotating pool** using a deterministic rule (no random flicker on refresh).

## What Changes

- Authenticated home workspace shows **three** example prompt controls near the main create input (always visible for signed-in users, not gated on empty library or first visit).
- Clicking a control **fills** the create textarea with that prompt’s text (user still submits manually unless product changes later).
- Example text comes from a **pool larger than three**; which three appear is chosen by a **documented deterministic** rule (e.g. calendar day and/or stable user id) so the set is stable for a session/day but varies over time and across users.
- Styling and a11y align with Sunlit Atelier and existing home form patterns (`button type="button"`, focus/keyboard).

## Capabilities

### New Capabilities

- _(none — behavior extends existing home workspace spec)_

### Modified Capabilities

- `home-screen-workspace`: Add normative requirements for always-visible rotating example prompt starters adjacent to the home create flow.

## Impact

- **Web**: `web/app/page.tsx` (HomeWorkspace), optional small module for pool + selection (e.g. `web/lib/...`), `web/app/globals.css` for chip/suggestion styling.
- **Backend**: None for v1 (copy and selection are client-side).
- **Specs**: Delta under `openspec/specs/home-screen-workspace/spec.md` via change folder delta.
