## Why

Users have no way to stop an in-flight AI reply — once sent, the generation runs to completion regardless of how long it takes or whether the user changes their mind. This is a standard AI chat feature (ChatGPT, Claude.ai) and its absence is a notable UX gap, especially for long experience-generation runs.

## What Changes

- New stop button replaces the disabled send button while a run is in progress
- New `POST /api/chat/threads/:threadId/runs/:runId/cancel` endpoint
- Backend abort registry (`Map<runId, AbortController>`) wires the cancel signal through the conversation loop into the LLM `fetch` call
- Conversation loop becomes abort-aware: checks signal before each LLM round and tool execution, saves partial assistant text on abort, rolls back sandbox state if generation was in-flight
- New `run_cancelled` SSE event type; frontend reducer handles it to clear active run and draft
- Cancelled runs surface in UI as "Reply stopped" (not an error); retry composer pre-fills the last prompt (same as failed runs)
- Credit usage recorded for tokens consumed before cancellation

## Capabilities

### New Capabilities

- `run-cancellation`: Cancel an in-flight assistant run — HTTP endpoint, backend abort registry, abort-aware conversation loop, partial-text persistence, sandbox rollback, and `run_cancelled` SSE event

### Modified Capabilities

- `chat-thread-runtime`: Run lifecycle gains `cancelled` terminal status handling and a new `run_cancelled` event type; retry composer triggers on cancelled runs (currently only on failed)
- `conversation-tool-loop`: Loop becomes abort-signal-aware — signal threaded through LLM calls and tool execution; partial assistant text persisted on abort; sandbox state rolled back if tool was mid-execution

## Impact

- **Backend**: `ConversationLoopService`, `ChatRuntimeService`, `ChatRuntimeController`, new `RunAbortRegistryService`, `ChatRuntimeEventService` (new event type), `runtime.enums.ts`
- **Frontend**: `chat/[threadId]/page.tsx` (stop button, cancel handler, `run_cancelled` event), `runtime-state.ts` (reducer + `isRunActive` + `getRetryComposerValue`), `chat-composer.tsx` (stop button UI state)
- **DB**: No schema changes — `cancelled` status already exists in `assistant_runs.status`
- **APIs**: One new endpoint; no breaking changes to existing endpoints
