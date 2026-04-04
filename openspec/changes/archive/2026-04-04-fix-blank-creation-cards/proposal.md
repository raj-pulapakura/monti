## Why

Creation cards in the home screen Recents carousel show a hardcoded "Creation Preview" placeholder instead of actual experience content, giving users no visual signal of what each creation looks like. This makes the carousel nearly useless for navigating back to past work.

## What Changes

- Replace the static `div.creation-thumb` placeholder in each creation card with a live scaled-down iframe rendering the experience's HTML/CSS/JS
- Enrich the thread list API response to include the latest experience version's HTML, CSS, and JS alongside existing thread metadata
- Cards without an experience (threads that never generated output) fall back to a styled empty-state placeholder

## Capabilities

### New Capabilities
- `creation-card-live-preview`: Sandboxed live iframe preview rendered at small scale inside each creation card, sourced from the thread's latest experience version

### Modified Capabilities
- `home-screen-workspace`: The "Display past creations carousel" requirement changes — cards now render live experience previews instead of placeholder artwork

## Impact

- `web/app/page.tsx` — `ThreadCard` type and card rendering updated
- `backend/src/chat-runtime/` — thread list endpoint enriched with experience version HTML/CSS/JS
- No new dependencies, no storage layer, no external services
