# Monti Backend

NestJS backend for Monti's chat-first runtime and sandbox orchestration.

## API Surface

### Chat Runtime (Primary)

- `POST /api/chat/threads`
  - Creates a thread and initializes sandbox state.
- `GET /api/chat/threads/:threadId?clientId=<id>`
  - Hydrates thread metadata, ordered messages, sandbox state, active run, and latest event cursor.
- `POST /api/chat/threads/:threadId/messages`
  - Submits a user message (idempotent) and creates/updates run state.
- `GET /api/chat/threads/:threadId/sandbox?clientId=<id>`
  - Returns thread sandbox state and active artifact payload for iframe preview.
- `GET /api/chat/threads/:threadId/events` (SSE)
  - Streams runtime events (`run_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `assistant_message_created`, `sandbox_updated`, `run_failed`, `run_completed`).

### Legacy Endpoints (Compatibility)

- `POST /api/experiences/generate`
- `POST /api/experiences/refine`

These are guarded by `ENABLE_LEGACY_EXPERIENCE_API` and can be disabled during migration.

### Health

- `GET /`

## Feature Flags

The staged rollout uses these environment flags:

- `CHAT_RUNTIME_ENABLED`
  - `false|0|off` disables chat runtime endpoints.
- `NATIVE_TOOL_LOOP_ENABLED`
  - `false|0|off` keeps message ingestion/routing active but skips native tool execution.
- `ROUTER_STAGE_ENABLED`
  - `false|0|off` bypasses router-model inference and uses fallback route policy.
- `ENABLE_LEGACY_EXPERIENCE_API`
  - `false|0|off` disables `/api/experiences/*` compatibility endpoints.

## Rendering Contract

Generated output is rendered in a sandboxed iframe only:

- `sandbox="allow-scripts"`
- no direct host DOM injection
- no external network access from generated code
- no external script/library loading

## Environment Variables

Copy and configure:

```bash
cp .env.example .env
```

Core variables:

- `PORT` (default `3001`)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Schema

Apply all migrations in `../supabase/migrations/`.

Key files:

- `20260315000100_create_experience_persistence.sql`
- `20260315000200_create_chat_runtime.sql`
- `20260315000300_add_chat_submit_rpc.sql`
- `20260315000400_add_assistant_run_provider_traces.sql`

Schema snapshot:

- `../supabase/schemas/experiences.sql`

## Observability Signals

Structured logs are emitted for:

- routing decisions (`chat_runtime_route_selected`, `llm_routing_fallback`)
- tool success/failure (`chat_runtime_tool_succeeded`, `chat_runtime_tool_failed`)
- generation orchestration lifecycle (`ui_generation_*`)

These signals are intended for dashboards on:

- router decision distribution
- provider/model selection distribution
- tool latency and failure rate
- run terminal status rates

See runbook: `../docs/chat-runtime-runbook.md`.

Additional docs:

- `../docs/chat-runtime-observability.md`
- `../docs/chat-runtime-parity-checklist.md`

## Run

```bash
npm install
npm run start:dev
```

## Test

```bash
npm test
npm run test:e2e
```
