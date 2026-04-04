## Context

The home screen Recents carousel fetches threads via `GET /api/chat/threads`. Each `ThreadCard` currently has no experience content — only thread metadata and sandbox status. Cards render a hardcoded `div.creation-thumb` placeholder with the text "Creation Preview".

Each thread's sandbox state (`sandbox_states.experience_version_id`) already points to the latest experience version, which stores the full HTML, CSS, and JS. The content is there; it just isn't surfaced to the frontend.

## Goals / Non-Goals

**Goals:**
- Render each creation card as a live scaled-down iframe of the actual experience
- Enrich the thread list API to include the latest experience version content
- Cards without experience content (threads that never generated output) show a clean empty-state placeholder

**Non-Goals:**
- Screenshot generation or static image thumbnails
- Supabase Storage or any new infrastructure
- Caching / CDN for preview content
- Showing previews outside the home carousel (e.g. in chat thread header)

## Decisions

### Decision 1: Live iframe over static screenshot

Render the experience directly in a sandboxed `<iframe srcdoc={...}>` scaled with CSS `transform: scale(N)` inside a fixed-size clipped container. No screenshot service, no storage, no server-side rendering step.

**Alternatives considered:**
- Playwright/headless Chromium screenshot service — accurate but heavy, requires a separate Railway service and Supabase Storage
- html2canvas client-side — no server needed but quality is unreliable and adds a JS dependency
- Static images — stale after refinement unless re-generated

**Rationale:** The iframe approach is zero-infrastructure, always current, visually identical to the real experience, and consistent with how Lovable renders card previews.

### Decision 2: Enrich thread list endpoint rather than adding a new endpoint

Extend the existing `GET /api/chat/threads` response to include `experienceHtml`, `experienceCss`, `experienceJs` fields per thread. The frontend already calls this endpoint and maps threads to cards — minimal change surface.

**Rationale:** Adding a new per-thread endpoint would require N additional requests on page load. A JOIN at the list query is one round trip.

### Decision 3: Join via sandbox_states → experience_versions

`sandbox_states` has `experience_version_id` and `thread_id`. After fetching threads, fetch sandbox states (already done), then use `experience_version_id` to batch-fetch `experience_versions.html/css/js` in one query.

### Decision 4: Null content = empty-state placeholder

Threads with no `experience_version_id` (sandbox never reached `ready`) return `null` for all three content fields. The card renders a styled "No preview yet" placeholder rather than a blank iframe.

### Decision 5: iframe sandbox and scale

- `sandbox="allow-scripts"` — scripts run but no navigation, popups, or same-origin access
- JS sanitized: `experience.js.replace(/<\/script/gi, '<\\/script')` (same pattern as play page)
- Scale factor sized to card thumb dimensions: iframe rendered at full viewport width (e.g. 960px) and scaled to card width (~200px) → scale ≈ 0.21
- `pointer-events: none` on iframe so card click-through works correctly
- `loading="lazy"` on iframe to defer off-screen cards

## Risks / Trade-offs

- **Many iframes on one page** → browser renders all card content simultaneously. Mitigation: `loading="lazy"` defers off-screen iframes; carousel only shows 3-4 cards at a time.
- **Iframe JS may call external APIs** (e.g. fetch) → contained by `sandbox="allow-scripts"` which blocks navigation and cross-origin cookies. Not a security issue for the creator's own content.
- **Content payload size** → each thread now returns full HTML/CSS/JS in the list response. For users with many threads this could be large. Mitigation: limit already at 1000 threads but in practice most users have <20; the `limit` query param remains available.
- **No stale-thumbnail problem** → iframes always show the current `experience_version_id` content; no cache invalidation needed.

## Migration Plan

1. Backend: extend `listThreads` repository method to batch-fetch experience version content — no schema changes needed
2. Backend: update service and controller response shape to include experience content fields
3. Frontend: update `ThreadCard` type, build srcdoc from fields, replace `div.creation-thumb` with scaled iframe + fallback
4. Deploy backend before or simultaneously with frontend — frontend degrades gracefully (shows placeholder) if fields are absent
