## Why

Monti currently centers the authenticated experience on `/app` with a local-storage active-thread model, which prevents stable deep links and does not match the intended home-first workflow. We need a hard-cut navigation model where `/` is the definitive entrypoint and chat experiences are URL-addressable via thread IDs.

## What Changes

- **BREAKING** Remove `/app` as the application surface and replace it with a root-entry model:
  - unauthenticated users visiting `/` see marketing
  - authenticated users visiting `/` see the home workspace
- Add a dedicated protected route `/chat/<threadId>` as the canonical chat runtime URL.
- Replace local-storage-driven thread bootstrap with URL-driven thread identity for chat sessions.
- Add home-screen create flow:
  - user enters a prompt on `/`
  - system creates a thread
  - system navigates to `/chat/<threadId>`
  - prompt is handed off via session storage and submitted immediately on chat load
- Add home-screen “Past Creations” carousel that lists all user threads using placeholder card images and thread subtitle text sourced from `chat_threads.title`.
- Add backend thread-list API for home-screen cards and set `chat_threads.title` from the first user prompt snippet (server-controlled).
- Update auth redirects, protected route matching, and next-path defaults to align with `/` + `/chat/*` routing.

## Capabilities

### New Capabilities
- `home-screen-workspace`: Defines authenticated home behavior at `/`, create handoff to `/chat/<threadId>`, and past-creations carousel rendering.

### Modified Capabilities
- `web-public-protected-routing`: Replace `/app`-centric routing requirements with root entrypoint behavior and `/chat/*` protected routing.
- `chat-thread-runtime`: Extend runtime requirements to support thread listing metadata for home UI and server-owned thread title seeding from first user turn.

## Impact

- Web routing and middleware: root/auth redirect logic, protected matcher coverage, auth callback next-path defaults.
- Web app structure: split current `/app` runtime page into root home page plus dynamic `/chat/[threadId]` runtime page.
- Runtime API surface: add authenticated thread list endpoint for home carousel.
- Runtime persistence behavior: first user message sets thread title snippet when missing.
- Tests/docs/specs: update route-access/auth-flow tests, runtime API tests, and documentation/spec artifacts to remove `/app` assumptions.
