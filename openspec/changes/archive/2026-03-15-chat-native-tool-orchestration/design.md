## Context

Monti currently ships a form-driven interaction model centered on two synchronous endpoints:
- `POST /api/experiences/generate`
- `POST /api/experiences/refine`

The backend orchestration (`ExperienceOrchestratorService`) already supports multiple providers and safety/validation gates, but it is request-oriented rather than conversation-oriented. The current frontend (`web/app/page.tsx`) is also request-oriented: prompt controls on the left and iframe preview on the right with local-storage history.

The next product version is chat-first:
- Left pane is a persistent chat timeline.
- Right pane is a thread-coupled sandbox view.
- "Generate/refine" becomes a tool execution inside assistant turns.
- UI shows run lifecycle updates (`creating`, `created`, `failed`) inline in chat.

Additional constraints:
- Provider integrations must remain replaceable (OpenAI, Anthropic, Gemini).
- Native tool calling should be used per provider for long-term correctness.
- Fast/quality must be removed from UI; routing is decided internally by a lightweight router LLM call.
- Existing payload validation and safety constraints must remain enforced.
- Migration should minimize user-visible downtime and allow rollback.

## Goals / Non-Goals

**Goals:**
- Make `thread`, `message`, `assistant run`, and `tool invocation` first-class runtime primitives.
- Execute experience generation/refinement through a provider-native tool loop.
- Introduce LLM-based internal routing to choose execution tier/provider/model.
- Keep runtime behavior provider-agnostic via canonical internal models and adapter boundaries.
- Add thread-bound sandbox state persistence and event-driven frontend sync.
- Preserve secure rendering contract (iframe-only with sandbox restrictions).
- Provide a phased migration path from form APIs to chat APIs.

**Non-Goals:**
- Building multi-user collaborative chat in this change.
- Building multi-tool planning beyond the initial `generate_experience` tool family (future extensibility only).
- Changing the generated artifact contract (`title`, `description`, `html`, `css`, `js`) in this phase.
- Replacing Supabase with a different persistence backend.
- Introducing monthly usage/billing policies in routing decisions.

## Decisions

### Decision 1: Adopt normalized chat/runtime schema (Option A)

**Decision**
Implement the normalized schema:
- `chat_threads`
- `chat_messages`
- `assistant_runs`
- `tool_invocations`
- `sandbox_states`

Retain existing artifact persistence tables (`experiences`, `experience_versions`, `generation_runs`) during migration, then progressively re-scope `generation_runs` responsibility to compatibility telemetry.

**Rationale**
- Matches the product model (chat and run lifecycle are explicit domain entities).
- Enables observability, retries, and deterministic run state transitions.
- Supports future tools without redesigning persistence.

**Alternatives considered**
- Lean schema (`threads + messages + tool_invocations`): faster short-term but weak run-state analytics/concurrency control.
- Event-sourced-only table: maximum flexibility but high implementation/migration complexity.

### Decision 2: Use canonical runtime model with provider adapters

**Decision**
Implement a canonical runtime interface that all provider adapters implement:
- Canonical input: system prompt, message sequence, tool schema list, token/temperature/options.
- Canonical output: assistant content, tool calls, completion reason, usage, provider metadata.

Provider adapters perform translation:
- Canonical -> provider-native request shape
- Provider-native response -> canonical tool/message events

Raw provider payloads are stored for debugging, but business logic consumes canonical forms.

**Rationale**
- Preserves provider agnosticism without giving up native tool-calling APIs.
- Localizes provider drift/fixes to adapter boundaries.
- Keeps orchestration and database schema stable as providers evolve.

**Alternatives considered**
- Provider-specific orchestration flows and schemas: fastest initial coding, high long-term coupling and bug surface.

### Decision 3: Add dedicated LLM routing stage (cheap router model)

**Decision**
Before execution, each assistant run calls a lightweight router model that returns structured routing output:
- `tier`: `fast` | `quality`
- `preferred_provider`: optional
- `confidence`: number
- `reason`: short text

Execution policy maps router output to concrete provider+model using `LlmConfigService` policy.
If router call fails, fallback to policy default route.

**Rationale**
- Removes user-facing quality controls while preserving adaptive quality/cost behavior.
- Keeps routing decision explicit and auditable in `assistant_runs`.

**Alternatives considered**
- Rules-only routing: deterministic but lower quality for ambiguous requests.
- Hybrid rules + router: strong option, but intentionally deferred to reduce implementation complexity.

### Decision 4: Implement provider-native tool loop with tool executor boundary

**Decision**
Assistant run flow:
1. Call provider adapter with thread context and registered tool schemas.
2. If provider returns tool calls, persist each call and execute tool via internal executor registry.
3. Send tool results back to the same provider in native follow-up format.
4. Repeat until final assistant message is emitted or run fails.

Initial tool registry includes:
- `generate_experience`
- `refine_experience` (or an operation flag in one tool)

Tool executor reuses existing guardrails:
- prompt building
- payload validation
- safety checks
- artifact persistence

**Rationale**
- Aligns with provider-native tool semantics and avoids fragile custom action protocols.
- Reuses proven generation safety pipeline.

**Alternatives considered**
- Custom JSON action protocol: provider-independent but reinvents parsing/tool semantics and increases bug risk.

### Decision 5: Frontend integration through SSE lifecycle events + snapshot APIs

**Decision**
Expose:
- Snapshot APIs for thread hydration (`thread + messages + sandbox_state`)
- SSE stream for incremental runtime events (`run_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `assistant_message_created`, `sandbox_updated`, `run_failed`)

Frontend reducer updates both panes from canonical events.

**Rationale**
- Supports real-time UX from wireframes without polling-heavy client logic.
- Enables resilient reconnect (event id cursor + hydration replay).

**Alternatives considered**
- Polling-only status endpoints: simpler but laggier UX and higher read load.

### Decision 6: Deprecate old generate/refine endpoints via compatibility window

**Decision**
Keep old endpoints temporarily behind compatibility flag while new chat APIs launch, then remove as primary path once parity validation passes.

**Rationale**
- Reduces migration risk and allows staggered frontend rollout.

**Alternatives considered**
- Big-bang cutover: faster cleanup but higher outage/regression risk.

## Risks / Trade-offs

- [Provider API divergence over time] -> Maintain strict adapter contract tests per provider; add contract fixtures for tool loops.
- [Router model instability or low confidence decisions] -> Persist router outputs and fallback route path; add monitoring and manual override config.
- [Run concurrency race conditions per thread] -> Enforce per-thread run lock policy in DB and application service.
- [Event delivery gaps from SSE disconnects] -> Implement event cursors and mandatory hydration on reconnect.
- [Data migration complexity with old/new models coexisting] -> Use phased migration and dual-write where needed, with clear rollback toggles.
- [Increased persistence volume from message/tool/raw payload logs] -> Bound payload retention policy and archive older raw blobs.
- [Frontend state complexity] -> Centralize state in reducer keyed by thread id and run id; avoid provider-specific branches in client code.

## Migration Plan

### Phase 0: Foundations (no product behavior change)
- Add new DB schema and generated types for chat/runtime/sandbox tables.
- Introduce adapter interfaces, router service interfaces, and event envelope types.
- Add integration tests for adapter contract and run state machine transitions.

### Phase 1: Backend runtime availability
- Implement chat/thread APIs and SSE stream APIs.
- Implement assistant run orchestrator with provider-native tool loop.
- Wire `generate_experience` tool executor to existing validation/safety/artifact persistence.
- Write sandbox state updates and lifecycle events.

### Phase 2: Frontend cutover
- Replace form-based page flow with thread hydration + chat composer + event reducer.
- Bind right pane exclusively to persisted `sandbox_state` and artifact payload snapshots.
- Remove fast/quality UI controls.

### Phase 3: Compatibility and deprecation
- Keep old generate/refine endpoints functional behind compatibility path while monitoring new flow.
- Compare success/failure rates and latency parity across paths.
- Remove old endpoints from default frontend usage.

### Phase 4: Cleanup and hardening
- Remove dead orchestration paths and stale DTOs.
- Update docs and operational runbooks.
- Tighten observability dashboards around router decisions, tool success rates, and run failures.

### Rollback strategy
- Maintain feature flags:
  - `CHAT_RUNTIME_ENABLED`
  - `NATIVE_TOOL_LOOP_ENABLED`
  - `ROUTER_STAGE_ENABLED`
- If severe regressions occur, disable new runtime path and keep old generate/refine flow active while preserving already-written chat data.

## Open Questions

- Should refinement remain a distinct tool (`refine_experience`) or be a mode of `generate_experience` with required artifact reference fields?
- Do we allow multiple queued runs per thread, or exactly one active+pending run at a time?
- What retention window should raw provider payloads follow for privacy/cost control?
- Should router output include explicit safety-risk tags that can influence provider/model fallback?
- Should thread titles be assistant-generated from early messages or user-editable only?
