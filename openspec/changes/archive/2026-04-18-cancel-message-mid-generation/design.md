## Context

Currently `ConversationLoopService.executeTurn()` is fired with `void` from `ChatRuntimeService` — there is no handle to the running loop from outside. Once started, a run cannot be interrupted. The `ToolLlmRouterService` already accepts `signal?: AbortSignal` in its interface and the LLM `fetch` calls already thread `signal` through, but nothing ever passes a signal in. The DB `assistant_runs.status` already includes `cancelled` as a valid value.

The backend is a NestJS singleton-process app. There is no shared process state across restarts, but that is an acceptable constraint.

## Goals / Non-Goals

**Goals:**
- Users can stop a run at any point during LLM streaming or tool execution
- Partial assistant text streamed before cancel is persisted as the final message
- Sandbox state is rolled back cleanly if generation was in-flight at cancel time
- Credit usage for tokens consumed before cancel is recorded
- Frontend stop button replaces the disabled send button during generation

**Non-Goals:**
- Persistence of abort registry across server restarts (zombie runs on restart are a pre-existing problem, not introduced here)
- Cancelling a run that is in `awaiting_confirmation` state (the confirmation gate already handles this)
- Queuing or rate-limiting cancel requests

## Decisions

### Decision 1: In-memory AbortController registry on the backend

**Choice:** A new `RunAbortRegistryService` holds `Map<runId, AbortController>`. `ConversationLoopService` registers a controller at the start of each turn and releases it on any terminal outcome (succeeded, failed, cancelled).

**Why not DB-polling:** Polling would add 0.5–2s latency to actual abort, would not interrupt the in-flight LLM `fetch` (only the loop between steps), and costs extra DB reads on every turn.

**Why not event emitter or Redis:** Unnecessary complexity for a single-instance deployment. If multi-instance becomes relevant, the registry can be extracted then.

**Restart behavior:** On restart, runs stuck in `running` state have no registered controller. A cancel request for such a run will detect no registered controller and directly mark the run `cancelled` in the DB — no LLM abort needed since the process is gone.

### Decision 2: Persist partial assistant text on cancel

**Choice:** Whatever text was already streamed into `streamedAssistantText` is saved as the final assistant message when the run is cancelled.

**Why:** Users already saw the text streaming. Discarding it creates a confusing vanishing-content experience. Saving it is consistent with ChatGPT and Claude.ai behavior.

**Trade-off:** A partial sentence ends abruptly. This is acceptable — the `run_cancelled` event and "Reply stopped" UI label provide context.

### Decision 3: Sandbox rollback on cancelled generation

**Choice:** If `sandbox_state` is `creating` at cancel time, roll it back to the previous stable state (either `ready` with the prior experience, or `empty` if no experience existed). Do not set status to `error`.

**Why:** `error` implies something went wrong. Cancel is intentional. Rolling back to the prior stable state leaves the workspace usable without an error treatment.

**Implementation:** `RunAbortRegistryService` stores the sandbox state snapshot at the moment `tool_started` fires for `generate_experience`. On cancel, this snapshot is restored.

### Decision 4: New `run_cancelled` SSE event (not reuse `run_failed`)

**Choice:** Emit a new `run_cancelled` event type rather than repurposing `run_failed`.

**Why:** Frontend needs to distinguish cancelled (intentional) from failed (error) to show different copy and avoid the error treatment. Reusing `run_failed` with a special error code would require downstream conditional logic everywhere.

**Trade-off:** One more event type in the vocabulary. Low cost.

### Decision 5: Cancel endpoint at `POST .../runs/:runId/cancel`

**Choice:** `POST /api/chat/threads/:threadId/runs/:runId/cancel` rather than `DELETE`.

**Why:** Aligns with the existing `POST .../runs/:runId/confirm` pattern. Cancel is a state transition, not a resource deletion. The run record is preserved for audit/billing.

**Idempotency:** If the run is already in a terminal state when cancel arrives, return `200 OK` silently. Double-clicks and network retries are safe.

### Decision 6: Stop button replaces send button in-place

**Choice:** While `generationInFlight`, the send button icon and action change to a stop (square) icon that calls the cancel handler. The textarea stays disabled.

**Why:** Minimal layout change, consistent with ChatGPT/Claude.ai, no new UI surface needed.

## Risks / Trade-offs

- **Partial sentence UX** — text ends mid-word on fast cancel. Acceptable; the stop label contextualizes it.
- **Race: run completes before cancel arrives** — cancel endpoint detects terminal status and returns `200 OK` without marking cancelled. SSE `run_completed` event already updated frontend. No visible issue.
- **Race: cancel ack before `run_completed` SSE** — frontend shows optimistic cancelled state briefly before `run_completed` arrives via SSE. SSE event wins and updates `activeRun.status` to `succeeded`. Hydration confirms final state.
- **Zombie runs on restart** — pre-existing problem. Cancel path handles by DB-marking directly when no registry entry found.
- **Multi-instance deployments** — abort registry is in-process. Not a current concern; documented as a known limitation.

## Migration Plan

No DB migrations required. `cancelled` is already a valid `assistant_runs.status` value.

Deploy is a single atomic release — backend changes land with frontend. No staged rollout needed; the cancel endpoint is additive.

## Open Questions

- Should cancelled runs pre-fill the retry composer (like failed runs do)? **Decision: yes** — user likely wants to resend or edit.
- Should `run_cancelled` appear in `isRunActive()`? **Decision: no** — `cancelled` is terminal; active = queued/running/awaiting_confirmation.
