## 1. Fullscreen State And Browser Integration

- [x] 1.1 Add a host-owned preview wrapper ref and local fullscreen state to the thread preview component.
- [x] 1.2 Implement preview fullscreen entry and exit handlers using the browser Fullscreen API plus `fullscreenchange` synchronization.
- [x] 1.3 Handle fullscreen request failures and cleanup paths so the inline preview remains usable when fullscreen cannot be entered or is exited outside the component.

## 2. Fullscreen Preview UI

- [x] 2.1 Add a fullscreen entry control to the preview header when an active experience is available.
- [x] 2.2 Add host-owned fullscreen close controls and helper affordances that remain outside the generated iframe content.
- [x] 2.3 Update preview layout and styling so the iframe, overlays, and controls render correctly both inline and in fullscreen across desktop and mobile layouts.
- [x] 2.4 Preserve loading, refreshing, and error overlay behavior while the preview is displayed fullscreen.

## 3. Verification

- [x] 3.1 Add or update web test coverage for fullscreen state handling and preview control behavior where practical.
- [x] 3.2 Manually verify fullscreen entry, `Esc` exit, close-button exit, and preview status behavior during refresh and error flows.
