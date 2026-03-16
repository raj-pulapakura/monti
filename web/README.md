# Monti Web

Next.js frontend for Monti's chat-first generation experience.

## Runtime API Contracts

The UI is driven by chat runtime APIs and does not use legacy generate/refine endpoints.

Required backend endpoints:

- `POST /api/chat/threads`
- `GET /api/chat/threads/:threadId`
- `POST /api/chat/threads/:threadId/messages`
- `GET /api/chat/threads/:threadId/sandbox`
- `GET /api/chat/threads/:threadId/events` (SSE)

## Environment

Set backend base URL and Supabase public auth config:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Auth Routes

- Public landing page: `/`
- Protected app: `/app`
- Auth entry: `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`
- Auth callback/reset: `/auth/callback`, `/auth/reset-password`

## Future Hardening

- Production phase should require verified email before granting full `/app` access.

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
