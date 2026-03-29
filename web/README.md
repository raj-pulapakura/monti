# Monti Web

Next.js frontend for Monti's chat-first generation experience.

## Runtime API Contracts

The UI is driven by chat runtime APIs and does not use legacy generate/refine endpoints.

Required backend endpoints:

- `GET /api/chat/threads`
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

`NEXT_PUBLIC_*` values are used in both browser code and server-side route handlers. Because Next.js inlines public vars during `next build`, set them before building the production image.

## Auth Routes

- Root entrypoint: `/` (marketing for anonymous users, home workspace for authenticated users)
- Protected chat routes: `/chat/:threadId`
- Auth entry: `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`
- Auth callback/reset: `/auth/callback`, `/auth/reset-password`

## Future Hardening

- Production phase should require verified email before granting full authenticated workspace access.

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

- Chat identity is route-derived from `/chat/:threadId`.
- Home create flow uses one-time session storage prompt handoff (`monti_home_prompt_handoff_v1:<threadId>`).
- Message/history source of truth is backend hydration.
- Fast/quality selection is no longer exposed in UI; routing is internal to backend.
