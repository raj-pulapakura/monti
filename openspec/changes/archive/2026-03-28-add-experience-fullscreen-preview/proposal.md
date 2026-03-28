## Why

Monti already renders generated experiences in a dedicated sandbox preview, but the current preview stays confined to the right-hand panel. That makes rich interactive experiences feel cramped and limits the value of drafts that are meant to be explored, played, or presented at larger scale.

Users need a focused viewing mode that lets an experience take over the screen without breaking the existing sandbox safety model or forcing them into a separate route. Adding first-class fullscreen preview now improves the core generation loop at the exact moment when a user wants to enjoy or inspect the output.

## What Changes

- Add a fullscreen entry control to generated experience previews after an experience is available.
- Allow the sandbox preview container to enter browser fullscreen while keeping the generated experience rendered inside the existing sandboxed iframe.
- Provide explicit fullscreen exit affordances through both browser `Esc` behavior and a host-controlled close button rendered outside generated content.
- Preserve current preview loading, refreshing, and error overlays while the preview is displayed fullscreen.
- Keep fullscreen behavior scoped to the web client; no backend API, persistence, or generation contract changes are introduced.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `experience-preview-history`: The preview experience must support entering and exiting fullscreen from the thread workspace while preserving sandbox isolation and preview lifecycle feedback.

## Impact

- Web chat thread UI: preview header controls, fullscreen state handling, iframe container behavior, and fullscreen exit affordances.
- Shared web styling: fullscreen preview shell, overlay controls, and responsive behavior for desktop and mobile layouts.
- Browser integration: Fullscreen API event handling, rejected fullscreen request handling, and host-controlled escape/close semantics.
- Tests and specs: web preview behavior coverage and OpenSpec requirement deltas for preview fullscreen interactions.
