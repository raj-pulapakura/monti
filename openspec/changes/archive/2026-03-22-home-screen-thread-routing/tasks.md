## 1. Route Topology And Auth Policy Migration

- [x] 1.1 Remove the `/app` application route and establish `/` as the definitive entrypoint for authenticated home and unauthenticated marketing.
- [x] 1.2 Update middleware matchers and route-access policy to protect `/chat/:path*` and remove `/app`-specific protection logic.
- [x] 1.3 Update auth redirect helpers (`next` fallback and authenticated auth-page redirects) to use `/` instead of `/app`.
- [x] 1.4 Update route-access/auth-flow unit tests to assert the new `/` + `/chat/*` redirect behavior.

## 2. Backend Chat Runtime Extensions

- [x] 2.1 Add a new authenticated thread-list endpoint (`GET /api/chat/threads`) to the chat runtime controller/service contracts.
- [x] 2.2 Implement repository query for user-scoped thread summaries ordered by `updated_at desc`, with explicit default page size.
- [x] 2.3 Return list payload fields required by home cards (`id`, `title`, timestamps, archive metadata, and optional lightweight status).
- [x] 2.4 Implement server-side thread title seeding on first accepted user message when `chat_threads.title` is null.
- [x] 2.5 Ensure title seeding does not overwrite explicit or already-seeded thread titles on subsequent turns.
- [x] 2.6 Add backend tests for thread-list ownership scoping, ordering, unauthorized access, and title-seeding behavior.

## 3. Authenticated Home Workspace At Root

- [x] 3.1 Implement authenticated home UI at `/` with create input and past-creations carousel shell while preserving public marketing for anonymous users.
- [x] 3.2 Implement home create submission flow: create thread, write one-time session-storage handoff payload, navigate to `/chat/<threadId>`.
- [x] 3.3 Implement home thread-list fetch and rendering for all threads with placeholder artwork and subtitle fallback when title is missing.
- [x] 3.4 Implement card interaction to reopen existing threads by navigating to `/chat/<threadId>`.
- [x] 3.5 Add empty/loading/error home states for thread-list and create actions.

## 4. Chat Runtime Route Migration

- [x] 4.1 Move chat runtime page implementation from `/app` to dynamic route `/chat/[threadId]`.
- [x] 4.2 Remove `monti_active_thread_id_v1` local-storage bootstrap logic and make route param thread ID the only chat identity source.
- [x] 4.3 Consume and clear one-time session-storage prompt handoff on first `/chat/[threadId]` load, then submit exactly once.
- [x] 4.4 Preserve hydration, sandbox preview, optimistic message handling, and SSE reconnect behavior using path-derived thread ID.
- [x] 4.5 Implement clear UX path for invalid/inaccessible thread IDs (no silent failures).

## 5. Documentation, Verification, And Cleanup

- [x] 5.1 Update frontend/backend READMEs and runbooks to remove `/app` assumptions and document `/` + `/chat/:threadId` routes.
- [x] 5.2 Remove stale `/app` references from tests, helpers, and comments as part of hard-cut cleanup.
- [x] 5.3 Execute relevant backend and web test suites for routing, auth flow, and chat runtime behavior.
- [x] 5.4 Verify OpenSpec artifact status is complete and change is ready for `/opsx:apply`.
