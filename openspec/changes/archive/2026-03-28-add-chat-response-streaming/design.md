## Context

Monti already exposes a thread-scoped SSE endpoint for runtime lifecycle updates, but assistant text is still produced through a synchronous request path:
- the submit API waits for the full conversation turn to finish
- provider adapters return only a final `assistantText`
- the frontend only renders assistant output after `assistant_message_created` and a follow-up hydration refresh

That leaves the user with a stalled chat surface during longer runs even though the runtime already has a live event channel and reducer-based client state.

Key constraints:
- Persisted `chat_messages` are immutable timeline records and should remain the durable source of truth.
- The existing thread event stream already handles authentication, ordering, and reconnect cursors.
- Conversation execution must stay provider-agnostic across OpenAI, Anthropic, and Gemini.
- The frontend should not need provider-specific streaming logic.
- This change should avoid introducing a new database shape unless it is required for correctness.
- The streamed experience should feel visually intentional and aligned with the Sunlit Atelier system instead of falling back to generic spinners, abrupt text pops, or raw runtime wording.

## Goals / Non-Goals

**Goals:**
- Stream assistant replies incrementally over the existing thread event stream.
- Return control from message submission before the assistant turn fully completes.
- Preserve the immutable persisted chat timeline by keeping in-progress assistant text transient until final persistence.
- Extend the canonical provider/tool runtime contract so all providers can participate in the same streaming orchestration model.
- Allow the frontend reducer to render, update, and reconcile an in-progress assistant draft without per-chunk hydration requests.
- Define polished loading, draft, reconnecting, and recovery treatments so streaming improves both responsiveness and perceived quality.

**Non-Goals:**
- Persisting partial assistant drafts across full page refreshes or server restarts in this change.
- Introducing a second transport just for assistant text.
- Reworking sandbox preview persistence or generation artifact contracts.
- Adding run cancellation, pause/resume controls, or multi-worker job infrastructure.
- Redesigning the broader product visual system outside the state-feedback and chat/preview surfaces touched by streaming.

## Decisions

### Decision 1: Reuse the existing thread SSE endpoint for assistant progress

**Decision**
Extend `/api/chat/threads/:threadId/events` to emit assistant draft lifecycle events in addition to the existing run/tool/sandbox events.

The event contract will add streaming-oriented assistant events while preserving the existing persisted-message event:
- `assistant_message_started`
- `assistant_message_updated`
- `assistant_message_created`

`assistant_message_updated` payloads will carry cumulative draft content rather than raw token deltas so the frontend can replace the current draft body with the latest snapshot.

**Rationale**
- Reuses existing authentication, ordering, and reconnect semantics.
- Avoids splitting runtime state across two client transports.
- Cumulative snapshots make reducer reconciliation and replay simpler than append-only token deltas.

**Alternatives considered**
- Separate streaming endpoint per submission: tighter request/response coupling, but duplicates auth and reconnect handling.
- Streaming the submit `POST` response directly: complicates optimistic UI and does not align with the existing thread-scoped event model.
- Raw token delta events: lower bandwidth, but harder replay/reconciliation semantics and higher risk of duplicated/missing client text.

### Decision 2: Decouple submit acknowledgement from turn completion

**Decision**
The submit API will return after persisting the user message and initial run metadata, then schedule conversation execution asynchronously within the runtime process.

The response contract remains thread-scoped and includes the accepted user message plus current run state, but it no longer waits for terminal assistant output.

**Rationale**
- Streaming only helps if the frontend regains control immediately after submit.
- This is the smallest architecture change that unlocks incremental UX without introducing external job infrastructure.

**Alternatives considered**
- Keep synchronous submit and only stream internal events: the user still blocks on the HTTP request, which defeats the UX goal.
- Introduce a durable background worker now: more robust long term, but significantly larger than the streaming change itself.

### Decision 3: Keep streamed assistant text transient until final assistant persistence

**Decision**
Assistant draft text will live only in runtime events and frontend reducer state until the conversation loop reaches a terminal assistant turn. Only the final assistant message is persisted to `chat_messages`.

No new mutable message table or draft persistence model is introduced in this change.

**Rationale**
- Preserves the existing immutable message timeline contract.
- Avoids database churn from frequent partial updates.
- Keeps hydration APIs simple: they continue to expose persisted state, not transient drafts.

**Alternatives considered**
- Mutating the final `chat_messages` row as text streams in: breaks immutability guarantees.
- Separate persisted draft table: improves refresh durability, but adds schema and reconciliation complexity not required for the initial streaming experience.

### Decision 4: Extend the canonical provider adapter contract to support streaming callbacks

**Decision**
The shared provider adapter interface will grow from “return a final turn response” to “emit incremental assistant progress and then return the final normalized turn result.”

The canonical streaming model will support:
- assistant text start/update notifications
- accumulation of final assistant text
- accumulation of tool calls and tool-call arguments until the provider turn is complete

Provider-specific streaming APIs stay inside the adapters; the conversation loop consumes only canonical callbacks and the final normalized response.

**Rationale**
- Preserves provider-agnostic orchestration.
- Prevents frontend or runtime services from taking direct dependencies on provider wire protocols.
- Lets streaming and tool-loop behavior evolve behind one contract boundary.

**Alternatives considered**
- Provider-specific streaming branches in the conversation loop: faster initially, but creates long-term divergence and higher maintenance cost.
- Continue using only final provider responses and synthesize fake streaming: simpler implementation, but not actual streaming.

### Decision 5: Use reducer-owned draft rendering on the frontend

**Decision**
The frontend runtime state will track a transient assistant draft alongside persisted messages. The reducer will:
- create the draft on `assistant_message_started`
- replace its content on `assistant_message_updated`
- drop or reconcile the draft when `assistant_message_created`, `run_completed`, or `run_failed` arrives

Hydration refreshes remain tied to persisted-state boundaries, not every draft update.

**Rationale**
- Keeps per-chunk UI responsive without extra network reads.
- Prevents transient draft state from polluting durable timeline state.
- Maintains the existing hydration model as the repair path after reconnect or page reload.

**Alternatives considered**
- Re-hydrate on every assistant chunk: much higher backend load and visible UI jitter.
- Render draft text outside reducer state: simpler short term, but harder to keep consistent with reconnect and completion events.

### Decision 6: Make streamed state feedback a first-class Sunlit Atelier presentation pattern

**Decision**
Streaming-related UI states will use explicit shared visual treatments across chat and preview rather than route-local loading text. The implementation should include:
- a clear draft-assistant presentation distinct from persisted assistant messages
- motion-safe loading and waiting treatments for hydration, preview handoff, and long-running generation
- reconnecting and retry surfaces that use creator-centered copy and shared state styling
- harmonized chat and preview components so the workspace feels cohesive while the assistant is actively drafting

These treatments should build on the existing Sunlit Atelier token, motion, and state-feedback patterns rather than inventing one-off streaming styles.

**Rationale**
- Streaming quality is perceived through the UI as much as through response latency.
- Explicit visual requirements reduce the risk of shipping a technically streamed experience that still feels rough or unfinished.
- Reusing the design language keeps the change additive to the current web system.

**Alternatives considered**
- Leave visual polish to implementation judgment: too easy for delight-oriented UX work to be deprioritized.
- Create streaming-specific styles outside the design language: faster locally, but increases long-term UI drift.

## Risks / Trade-offs

- [In-process asynchronous execution can be lost on process crash or restart] -> Keep the first rollout behind a feature flag and document that durable background recovery is a future enhancement.
- [Cumulative draft snapshots increase event payload size] -> Coalesce updates at sensible intervals and keep draft events transient rather than persisting them.
- [Provider streaming APIs differ in how they emit text and tool calls] -> Normalize provider behavior inside adapter tests and contract fixtures before wiring orchestration.
- [Client can temporarily show both draft and final assistant state] -> Reconcile draft state by run/message identifiers and clear transient state on `assistant_message_created` and terminal run events.
- [Submit/loading semantics become more complex] -> Separate short-lived request submission state from longer-lived run-progress state in the frontend.
- [More ambitious feedback styling can create motion or accessibility regressions] -> Reuse existing reduced-motion rules and keep all streaming cues legible without animation.

## Migration Plan

1. Extend runtime event types and shared canonical provider contracts to represent assistant draft start/update semantics.
2. Update conversation execution so submits acknowledge early and assistant streaming events are published during turn execution.
3. Add streaming support to provider adapters and normalize tool-call accumulation through the canonical runtime interface.
4. Update frontend reducer and chat rendering to show transient assistant drafts and reconcile them with persisted assistant messages.
5. Apply shared Sunlit Atelier feedback treatments to chat and preview loading, streaming, reconnecting, and recovery states.
6. Expand backend, frontend, and spec-driven tests for replay, reducer reconciliation, provider contract behavior, and streamed-state UX handling.

Rollback strategy:
- Gate the behavior behind a dedicated streaming flag.
- If needed, disable assistant draft events and restore the existing full-response UX while leaving persisted thread data untouched.

## Open Questions

- Do we want the initial rollout to coalesce draft updates by time, character count, or both?
- Is in-process asynchronous execution sufficient for the first production rollout, or do we want to pair this change with a durable worker before implementation?
- Which streamed-state cues should animate by default versus fall back to static presentation under reduced-motion preferences?
