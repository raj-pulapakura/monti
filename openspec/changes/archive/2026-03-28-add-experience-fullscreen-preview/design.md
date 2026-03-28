## Context

Monti currently renders generated experiences inside the thread workspace as a `srcDoc`-backed sandboxed iframe. The preview is constrained to the right-hand panel, which keeps the creation workflow compact but leaves interactive experiences feeling cramped once a user wants to explore, demo, or play through the result.

This feature sits entirely in the web client, but there are still meaningful constraints:
- The preview must remain isolated inside the existing sandboxed iframe model rather than injecting generated markup into the host DOM.
- Users must be able to exit fullscreen with browser `Esc`, even when focus has moved into the iframe content.
- The host app must provide its own explicit close affordance instead of relying on generated experience code.
- Existing preview overlays for loading, refresh, and failure states should keep working in fullscreen.
- No backend API, persistence, or runtime-event contract changes are necessary for this behavior.

## Goals / Non-Goals

**Goals:**
- Let users enter fullscreen from an active experience preview in the thread workspace.
- Keep the generated experience running inside the existing sandboxed iframe while fullscreen is active.
- Support two exit paths: browser `Esc` and a host-controlled close button.
- Preserve preview lifecycle feedback and responsive layout quality in fullscreen mode.
- Keep the implementation local to the web client without changing backend or persistence contracts.

**Non-Goals:**
- Allowing generated experience code to request fullscreen on its own.
- Creating a new route, viewer page, or separate window for immersive preview.
- Persisting fullscreen state across reloads, hydration, or devices.
- Redesigning the broader thread workspace beyond the preview controls and fullscreen shell.

## Decisions

### Decision 1: Use the browser Fullscreen API on a host-owned preview wrapper

**Decision**
The web client will request browser fullscreen on a host-owned wrapper that contains the iframe and host overlays, rather than simulating fullscreen with CSS alone.

The fullscreen state will be synchronized from `document.fullscreenElement` via `fullscreenchange`, and the host close button will call `document.exitFullscreen()`.

**Rationale**
- Browser fullscreen provides reliable `Esc` exit semantics even when focus is inside iframe content.
- Fullscreening the wrapper preserves the existing iframe instance, which avoids resetting in-experience state just to enlarge the preview.
- The wrapper can contain both generated content and host-controlled chrome such as the close button and status overlays.

**Alternatives considered**
- CSS-only fixed overlay: visually similar, but does not provide dependable browser-level `Esc` behavior once iframe content has focus.
- Request fullscreen from inside the iframe content: would require expanding iframe permissions and would hand control to generated code that the host should not trust.
- Open the experience in a separate route or window: increases complexity and remounts the experience unnecessarily.

### Decision 2: Keep fullscreen ownership in the host document and preserve iframe sandboxing

**Decision**
The preview will continue using the existing sandboxed iframe contract for generated content. The host document, not the generated experience, owns fullscreen entry and exit behavior.

This change does not require `allowfullscreen` or `allow=\"fullscreen\"` on the iframe because the iframe itself is not the fullscreen requester.

**Rationale**
- Preserves the current preview isolation model and avoids broadening the privilege surface of generated content.
- Keeps fullscreen UI predictable because the host owns both the control and the exit path.
- Aligns with the current spec direction that generated output must stay inside a sandboxed iframe preview.

**Alternatives considered**
- Grant fullscreen permission to iframe content: unnecessary for the desired user flow and expands trust in generated code without user benefit.

### Decision 3: Keep fullscreen controls and lifecycle overlays host-owned

**Decision**
The entry control will live in the preview header beside the experience title. While fullscreen is active, the host will render a prominent close button and lightweight fullscreen hint above the iframe, and existing preview overlays will remain available for loading, refresh, and failure states.

**Rationale**
- Users need a guaranteed escape hatch that cannot be removed or obscured by generated experience code.
- Reusing host overlays keeps the fullscreen experience consistent with inline preview behavior.
- Header-triggered entry keeps the affordance discoverable without modifying the generated document.

**Alternatives considered**
- Inject fullscreen controls into the `srcDoc` document: breaks separation between host UI and generated content and is harder to keep stable across arbitrary experiences.
- Hide all host chrome in fullscreen: more immersive, but makes exit and state feedback less reliable for v1.

### Decision 4: Treat fullscreen as ephemeral local UI state

**Decision**
Fullscreen mode will be maintained as local client state derived from browser fullscreen events. It will not be written into runtime hydration data, thread state, or persistence storage.

**Rationale**
- Browser fullscreen is inherently tab-local and session-ephemeral.
- Persisting it would complicate hydration and reconnect semantics without improving the user experience.
- Keeping it local reduces coupling with the existing runtime reducer.

**Alternatives considered**
- Persist fullscreen preference in thread or local storage state: adds coordination work for a short-lived interaction mode that should simply reflect the current browser state.

## Risks / Trade-offs

- [Fullscreen requests can be rejected by browser rules or unsupported environments] -> Trigger requests only from explicit user clicks, catch promise rejections, and leave the inline preview usable when fullscreen cannot start.
- [Host controls may cover important content inside some experiences] -> Keep fullscreen chrome compact, pin it to the edges, and preserve the experience canvas as the dominant visual.
- [Browser fullscreen behavior varies across mobile and desktop environments] -> Keep the inline preview fully functional and validate the v1 flow with manual cross-browser checks.
- [Fullscreen state can drift if the browser exits fullscreen outside React control] -> Source the state from `fullscreenchange` rather than assuming button clicks are authoritative.

## Migration Plan

1. Add a host-owned preview wrapper ref and local fullscreen state to the thread page preview component.
2. Add a fullscreen entry control in the preview header and host-owned exit controls for fullscreen mode.
3. Wire `requestFullscreen()`, `exitFullscreen()`, and `fullscreenchange` handling around the existing iframe preview wrapper.
4. Extend preview styling so the wrapper, overlays, and controls behave correctly in fullscreen on desktop and mobile layouts.
5. Add or update web test coverage for fullscreen state handling where practical, and manually verify browser fullscreen entry, `Esc` exit, and close-button exit.

Rollback strategy:
- Remove or disable the fullscreen controls in the web client.
- The underlying preview iframe and backend contracts remain unchanged, so rollback is isolated to frontend behavior.

## Open Questions

- Do we want the fullscreen close controls to stay persistently visible in v1, or fade after inactivity once the baseline interaction is proven?
