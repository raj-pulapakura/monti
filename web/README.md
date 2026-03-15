# Monti Web

Next.js frontend for Monti's chat-first generation experience.

## Runtime API Contracts

The UI is driven by chat runtime APIs and does not use legacy generate/refine endpoints.

Required backend endpoints:

- `POST /api/chat/threads`
- `GET /api/chat/threads/:threadId?clientId=...`
- `POST /api/chat/threads/:threadId/messages`
- `GET /api/chat/threads/:threadId/sandbox?clientId=...`
- `GET /api/chat/threads/:threadId/events` (SSE)

## Environment

Set backend base URL:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Thread identity is persisted in local storage key `monti_active_thread_id_v1`.
- Message/history source of truth is backend hydration, not local recent-history storage.
- Fast/quality selection is no longer exposed in UI; routing is internal to backend.
