## 1. Backend — Enrich Thread List with Experience Content

- [x] 1.1 In `ChatRuntimeRepository.listThreads`, after fetching sandbox states, collect all non-null `experience_version_id` values and batch-fetch `html`, `css`, `js` from `experience_versions`
- [x] 1.2 Build a map from `experience_version_id` → `{ html, css, js }` and merge into each thread row as `experience_html`, `experience_css`, `experience_js` (null when no version)
- [x] 1.3 Update `ThreadListRow` interface to include the three new nullable fields
- [x] 1.4 Update `ChatRuntimeService.listThreads` return type and mapping to expose `experienceHtml`, `experienceCss`, `experienceJs` in the service output
- [x] 1.5 Update `ChatRuntimeController` thread list response shape to include the three fields

## 2. Frontend — Live Iframe Card Thumbnails

- [x] 2.1 Update `ThreadCard` type in `web/app/page.tsx` to add `experienceHtml: string | null`, `experienceCss: string | null`, `experienceJs: string | null`
- [x] 2.2 Add a `buildSrcdoc(html, css, js)` helper that assembles a full HTML document string with sanitized JS (`replace(/<\/script/gi, '<\\/script')`)
- [x] 2.3 Replace `div.creation-thumb` in the card render with a conditional: if experience content exists render a scaled `<iframe>` with `srcdoc`, `sandbox="allow-scripts"`, `pointer-events: none`, and `loading="lazy"`; otherwise render a styled empty-state placeholder
- [x] 2.4 Add CSS for the iframe inside `.creation-thumb`: fixed iframe dimensions (e.g. 960×600), `transform: scale(0.21)`, `transform-origin: top left`, `overflow: hidden` on the container

## 3. Verification

- [x] 3.1 Verify existing threads with a ready sandbox show live previews on home screen
- [x] 3.2 Verify threads with no experience (sandbox empty/creating) show the empty-state placeholder
- [x] 3.3 Verify clicking a card with a live iframe preview navigates correctly to `/chat/<threadId>`
- [x] 3.4 Verify iframes are sandboxed — experience scripts cannot navigate the parent page
