# Monti Backend

NestJS backend for Monti's chat-first runtime and sandbox orchestration.

## API Surface

### Chat Runtime (Primary)

- `POST /api/chat/threads`
  - Creates a thread and initializes sandbox state for the authenticated user.
- `GET /api/chat/threads/:threadId`
  - Hydrates thread metadata, ordered messages, sandbox state, active run, and latest event cursor.
- `POST /api/chat/threads/:threadId/messages`
  - Submits a user message (idempotent) and creates/updates run state.
- `GET /api/chat/threads/:threadId/sandbox`
  - Returns thread sandbox state and active artifact payload for iframe preview.
- `GET /api/chat/threads/:threadId/events` (SSE)
  - Streams runtime events (`run_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `assistant_message_created`, `sandbox_updated`, `run_failed`, `run_completed`).

All `/api/chat/*` endpoints require `Authorization: Bearer <supabase-access-token>`.

### Health

- `GET /`

## Feature Flags

The staged rollout uses these environment flags:

- `CHAT_RUNTIME_ENABLED`
  - `false|0|off` disables chat runtime endpoints.
- `CONVERSATION_LOOP_ENABLED`
  - `false|0|off` bypasses the new conversation-model loop and only persists user turns.
- `ROUTER_STAGE_ENABLED`
  - `false|0|off` bypasses router-model inference and uses fallback route policy.
- `GENERATE_EXPERIENCE_TOOL_ENABLED`
  - `false|0|off` removes the `generate_experience` tool from the conversation loop (chat-only mode).

Conversation-model settings:

- `CONVERSATION_PROVIDER` (`openai|anthropic|gemini`, default `openai`)
- `CONVERSATION_MODEL` (default `gpt-5.4`)
- `CONVERSATION_MAX_TOKENS` (default `4096`)
- `CONVERSATION_MAX_TOOL_ROUNDS` (default `4`)
- `LLM_MAX_TOKENS_DEFAULT` (generation default output budget, default `16384`)
- `LLM_MAX_TOKENS_RETRY` (generation retry ceiling after max-token errors, default `32768`)

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
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_ISSUER` (optional; defaults from `SUPABASE_URL`)
- `SUPABASE_JWT_AUDIENCE` (default `authenticated`)

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
- conversation loop rounds (`conversation_loop_round_started`, `conversation_loop_round_completed`)
- conversation terminal lifecycle (`conversation_loop_completed`, `conversation_loop_failed`)
- tool success/failure (`tool_succeeded`, `tool_failed` events + persisted tool invocation telemetry)
- generation orchestration lifecycle (`ui_generation_*`)

These signals are intended for dashboards on:

- router decision distribution
- provider/model selection distribution
- tool latency and failure rate
- run terminal status rates

See runbook: `../docs/chat-runtime-runbook.md`.

## Rollback

To reduce risk quickly while preserving data:

1. Set `CONVERSATION_LOOP_ENABLED=false`.
2. Keep `CHAT_RUNTIME_ENABLED=true` so thread/message APIs remain available.
3. Optionally set `GENERATE_EXPERIENCE_TOOL_ENABLED=false` to enforce chat-only mode.
4. Redeploy backend and monitor `run_failed`/`conversation_loop_failed` logs for stabilization.

Additional docs:

- `../docs/chat-runtime-observability.md`
- `../docs/chat-runtime-parity-checklist.md`

## Future Hardening

- Require verified email before allowing full `/app` access in staging/production environments.

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
