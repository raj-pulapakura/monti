## Context

The current web app uses `/app` as the authenticated workspace and relies on a local-storage active-thread key (`monti_active_thread_id_v1`) to determine which thread to load. This model conflicts with the desired product shape: authenticated users should land on a home workspace first, and each chat experience should be directly addressable by URL.

Backend chat runtime APIs are already thread-scoped (`/api/chat/threads/:threadId/...`) and enforce authenticated ownership, which gives us a strong foundation for URL-based chat routing. The missing pieces are: route topology changes, home-screen UX/API for thread cards, and a canonical server-owned subtitle source for cards.

Constraints:
- Hard-cut development migration: no backward compatibility with `/app` and no compatibility shims.
- No image storage work in this change; card images must use placeholders.
- Carousel should show all threads (not only generated/ready threads).

## Goals / Non-Goals

**Goals:**
- Make `/` the definitive entrypoint:
  - unauthenticated users see marketing
  - authenticated users see home workspace
- Introduce protected `/chat/:threadId` route as canonical chat runtime URL.
- Make chat runtime load entirely from path `threadId` instead of local-storage active thread.
- Add home create flow that creates thread, navigates to `/chat/:threadId`, and auto-submits first prompt via non-URL handoff.
- Add authenticated thread list API and home carousel for all threads.
- Seed `chat_threads.title` from first user prompt snippet on the server side for card subtitle consistency.

**Non-Goals:**
- Persistent image generation or thumbnail storage.
- New sharing/public experience routes.
- LLM-generated title synthesis.
- Backward compatibility for `/app` URLs, redirect aliases, or dual-route support.

## Decisions

### 1) Route topology hard cut to `/` + `/chat/:threadId`

**Decision:** Remove `/app` as an application route. Use `/` as session-aware entrypoint and `/chat/:threadId` as protected chat workspace.

**Rationale:**
- Aligns URL model with product intent (home first, deep-linkable chats).
- Removes ambiguous runtime state from local storage and makes routing deterministic.
- Reuses existing backend ownership checks keyed by thread ID.

**Alternatives considered:**
- Keep `/app` and add `/chat/:threadId` incrementally: rejected due to duplicate navigation model and unnecessary compatibility complexity.
- Use `/chat` with query parameter `threadId`: rejected because path params provide cleaner canonical URLs and clearer guard/matcher behavior.

### 2) Path `threadId` is source of truth; prompt handoff uses session storage

**Decision:** Chat page state derives from route param only. Home-to-chat initial prompt handoff uses session storage keyed by thread ID and consumed once on chat load.

**Rationale:**
- Avoids sensitive prompt text in query strings/history.
- Avoids reviving long-lived local-storage active-thread coupling.
- Supports straightforward “create then navigate then submit” flow without new backend temporary-state endpoints.

**Alternatives considered:**
- Query-string prompt handoff: rejected for privacy and URL length/history leakage reasons.
- Backend transient handoff table/cache: rejected as unnecessary infrastructure for current scope.

### 3) Home carousel reads from new thread-list API; all threads shown

**Decision:** Add authenticated `GET /api/chat/threads` endpoint returning user-scoped thread metadata sorted by `updated_at desc` for home cards.

**Initial payload shape (v1):**
- `id`
- `title` (nullable)
- `createdAt`
- `updatedAt`
- `archivedAt`
- optional lightweight status fields if inexpensive (e.g., latest sandbox status)

**Rationale:**
- Backend is source of truth and already user-scoped via auth.
- Keeps UI simple and avoids over-fetching full thread hydration for home cards.
- Matches “show all threads” requirement with predictable ordering.

**Alternatives considered:**
- Client-side composition from multiple existing APIs: rejected due to N+1 requests and slow initial home render.
- Complex RPC/view with rich joins: deferred; current scope favors simple service-layer composition.

### 4) Subtitle source is server-owned thread title seeded on first user turn

**Decision:** Set `chat_threads.title` from first user message snippet when thread title is null. Persist once and reuse for home cards.

**Rationale:**
- Stable, low-cost subtitle source.
- Prevents repeated “find first message” queries on every list request.
- Keeps ownership and formatting logic centralized in backend mutation path.

**Alternatives considered:**
- Compute subtitle by querying first user message per thread at read time: rejected for query cost and repeated logic.
- LLM-generated titles now: explicitly out of scope for this change.

### 5) Placeholder card images only

**Decision:** Home carousel cards render a static placeholder image treatment (single shared asset or visual block) for all threads.

**Rationale:**
- Satisfies immediate UI requirement while avoiding storage pipeline work.
- Keeps this change focused on routing and thread navigation model.

**Alternatives considered:**
- Runtime iframe snapshots: deferred due to performance/safety complexity for list views.
- Persisted thumbnails in storage: deferred to separate change.

### 6) Auth redirect and guard policy update

**Decision:**
- Protect `/chat/:path*` routes in middleware.
- Remove authenticated root redirect to `/app`; authenticated root must remain `/` (home).
- Update auth-entry redirects and next-path fallback from `/app` to `/`.

**Rationale:**
- Keeps route policy consistent with new topology.
- Prevents stale `/app` assumptions across sign-in/callback flows.

**Alternatives considered:**
- Keep `/app` fallback defaults temporarily: rejected because this is a hard-cut change.

## Risks / Trade-offs

- [Risk] Session-storage prompt handoff is tab-scoped and can be lost on hard refresh before consumption.
  → Mitigation: consume immediately on first chat render; if missing, chat still loads normally and user can re-enter prompt.

- [Risk] Threads created from home without successful first submit may produce untitled cards.
  → Mitigation: allow nullable title in cards with deterministic fallback copy (e.g., “Untitled creation”).

- [Risk] New list endpoint could become a hot path with many threads.
  → Mitigation: default limit + pagination contract in API; start with indexed `updated_at` ordering.

- [Risk] Hard cut can break existing bookmarks/tests referencing `/app`.
  → Mitigation: update all tests/docs in the same change and treat `/app` usage as invalid after merge.

## Migration Plan

1. Update OpenSpec requirements and tasks to reflect `/` + `/chat/:threadId` topology and home-screen capability.
2. Web migration:
   - move chat runtime UI to dynamic `/chat/[threadId]`
   - convert `/` into session-aware marketing/home entrypoint
   - remove `/app` route and local-storage active-thread pattern
   - implement session-storage prompt handoff from home create flow
3. Backend migration:
   - add authenticated thread-list endpoint
   - add thread-title seeding on first user message when title is null
4. Update middleware/auth defaults and redirect behavior to remove `/app` assumptions.
5. Update automated tests/docs to the new system.

Rollback strategy (development): revert the change set in git. No data migration rollback is required because no destructive schema transformation is planned for this change.

## Open Questions

- What default page size should the thread-list endpoint use before pagination controls are exposed in UI (for example, 20 vs 50)?
- Should home cards expose lightweight generation status badges in v1, or reserve status rendering for a follow-up UI pass?
