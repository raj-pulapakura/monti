## Context

Monti currently accepts a user message and immediately executes generation orchestration in `ChatRuntimeService.submitMessage`, then writes hardcoded assistant success/failure text. This blends two concerns that should evolve independently:

1. Conversational behavior (assistant voice, response style, tool choice)
2. Experience engine execution (routing, provider/model dispatch, sandbox/materialized state)

The target model is a true conversation-first tool loop:

- A fixed conversation model (for example OpenAI GPT-5.4) owns user-facing assistant dialogue.
- The conversation model invokes tools when needed.
- `generate_experience` is an engine boundary tool that performs router + generation + sandbox state sync.
- The conversation model receives tool results and authors the final user-facing assistant messages.

Architecturally, this should degrade cleanly to normal chat if generation tools are removed. That implies the conversation loop cannot assume generation is always present.

Major refactors are permitted for this change where they improve long-term separation and reduce coupling.

## Goals / Non-Goals

**Goals:**
- Separate conversation orchestration from generation engine execution.
- Make conversational responses model-authored before and after tool usage (no hardcoded runtime strings).
- Move router invocation into `generate_experience` tool execution path.
- Support tool-optional operation where Monti behaves like a standard chat assistant.
- Preserve provider-agnostic generation engine behavior and sandbox synchronization.
- Maintain reconnect-safe eventing/hydration guarantees for frontend state reduction.

**Non-Goals:**
- Replacing existing generation payload contract (`title`, `description`, `html`, `css`, `js`).
- Introducing multi-user collaboration or auth changes.
- Introducing a new UI paradigm beyond existing thread + sandbox structure.
- Implementing a full generic multi-tool planning platform beyond conversation loop + `generate_experience` in this phase.

## Decisions

### Decision 1: Introduce a dedicated Conversation Loop Orchestrator

**Decision**
Create a dedicated service boundary (conversation loop orchestrator) that executes:

- message context assembly
- fixed-model inference
- provider-native tool-calling loop
- assistant message persistence
- conversation run lifecycle state

This loop continues until a terminal assistant output with no additional tool calls.

**Rationale**
This isolates conversational intelligence and removes tool/business-specific branching from chat runtime service code.

**Alternatives considered**
- Keep orchestration in `ChatRuntimeService`: lower change scope but preserves coupling and hardcoded assistant text paths.
- Make generation engine own all assistant messaging: reduces LLM calls but violates chat-first conversational ownership.

### Decision 2: Use a fixed conversation model configuration

**Decision**
Conversation orchestration uses a single configured provider/model pair (for example `openai:gpt-5.4`) independent of generation routing policy.

Suggested config keys:
- `CONVERSATION_PROVIDER`
- `CONVERSATION_MODEL`
- `CONVERSATION_MAX_TOKENS`

**Rationale**
Conversation quality and personality should be stable; model selection for heavy generation should stay cost/performance-routed in the tool engine.

**Alternatives considered**
- Route conversation model per prompt: more dynamic but less consistent voice and more complexity.
- Use same router policy for conversation and generation: conflates two separate optimization goals.

### Decision 3: Keep generation as an engine tool boundary

**Decision**
`generate_experience` tool executor owns:
- routing inference (`tier` only)
- provider/model selection for generation
- generation/refinement invocation
- payload validation + safety checks
- persistence + sandbox updates
- structured tool result emission

Conversation loop receives only tool result contract and never directly executes generation internals.

**Rationale**
This preserves the existing generation safety/persistence stack while enforcing clean separation between dialogue and execution.

**Alternatives considered**
- Inline generation call from conversation loop: fewer layers but reintroduces coupling.
- External workflow engine for tools: flexible but unnecessary complexity in this phase.

### Decision 4: Define strict tool result contract for conversation follow-up

**Decision**
`generate_experience` returns a normalized result object to the conversation loop:

- `status`: `succeeded | failed`
- `generationId`: nullable
- `experienceId`: nullable
- `experienceVersionId`: nullable
- `errorCode`: nullable
- `errorMessage`: nullable
- `sandboxStatus`: `ready | error | creating | empty`

The conversation model then authors assistant follow-up content using this contract.

**Rationale**
Prevents brittle string-based handoffs and reduces hallucination risk by providing structured, bounded tool context.

**Alternatives considered**
- Plain text tool return: simple but loses machine-safe semantics and telemetry quality.

### Decision 5: Split run semantics into conversation run + generation execution correlation

**Decision**
Adopt two-level lifecycle tracking:
- conversation run lifecycle (one per user turn)
- generation execution lifecycle (zero-or-more per conversation run via tool invocations)

Persistence can evolve by either:
- extending current `assistant_runs` as conversation runs and linking generation records via correlation ids, or
- introducing explicit `conversation_runs` table and migrating references.

For this change, major refactor is allowed; choose whichever path yields cleaner invariants in implementation.

**Rationale**
Conversation completion should not be equivalent to generation completion. Toolless chat turns must be first-class.

**Alternatives considered**
- Single run type for all phases: easier initially but harder to model toolless and multi-tool turns.

### Decision 6: Update runtime event model for dual-loop state

**Decision**
Retain SSE + hydration strategy, but event payloads must distinguish conversation and generation progression.

Event families:
- conversation events: `run_started`, `assistant_message_created`, `run_completed`, `run_failed`
- tool events: `tool_started`, `tool_succeeded`, `tool_failed`
- sandbox events: `sandbox_updated`

Include correlation fields so frontend can map tool/sandbox activity to the owning conversation run.

**Rationale**
Frontend reducer remains deterministic during reconnect and does not need provider-specific logic.

**Alternatives considered**
- Poll-only status: simpler but weaker UX and more race conditions during reconnect.

### Decision 7: Enforce chat-only fallback mode when tools are absent

**Decision**
Conversation loop must execute with empty tool list and return normal assistant responses. Tool registry availability is optional at runtime.

**Rationale**
This validates architectural decoupling and makes the system robust to staged rollouts/tool outages.

**Alternatives considered**
- Fail request when tool missing: violates chat-first design and blocks non-generation conversations.

## Risks / Trade-offs

- [Higher latency per generation turn due to extra conversation steps] -> Use tight token budgets for conversation turns and optimize tool result payload size.
- [Increased cost from additional model calls] -> Use bounded context windows and observability alarms on conversation token usage.
- [State machine complexity with dual lifecycle] -> Define explicit state transitions and correlation IDs; enforce via contract tests.
- [Potential assistant hallucination about tool outcomes] -> Provide strict structured tool result schema and include only verified fields.
- [Refactor risk in existing runtime paths] -> Roll out behind flags and preserve compatibility endpoints during migration window.
- [Event ordering regressions] -> Keep monotonic cursor semantics and add reconnect/hydration consistency tests.

## Migration Plan

### Phase 0: Foundations
- Add/adjust config for fixed conversation model.
- Define canonical conversation loop interfaces and tool result schema.
- Add tests for loop termination rules and toolless behavior.

### Phase 1: Conversation Loop Introduction
- Implement conversation loop orchestrator and wire `submitMessage` to it.
- Remove hardcoded assistant success/failure text from runtime path.
- Persist conversation lifecycle and assistant outputs from model responses.

### Phase 2: Tool Engine Handoff
- Refactor `generate_experience` to execute routing + generation + sandbox sync within tool executor boundary.
- Move router invocation out of top-level submit flow into tool execution.
- Persist generation correlation metadata linked to conversation run.

### Phase 3: Frontend/Event Alignment
- Update hydration/event contracts for conversation + tool correlation metadata.
- Ensure reducer handles toolless chat turns and tool-driven turns uniformly.
- Validate reconnect behavior with mixed turn types.

### Phase 4: Hardening and Cleanup
- Remove stale coupling logic in old runtime service paths.
- Update docs/runbooks and observability dashboards for dual-loop architecture.

### Rollback strategy
- Keep feature flags to revert to prior flow quickly:
  - `CHAT_RUNTIME_ENABLED`
  - `NATIVE_TOOL_LOOP_ENABLED`
  - `ROUTER_STAGE_ENABLED`
- Add a new guard for conversation loop rollout (for example `CONVERSATION_LOOP_ENABLED`) so rollback can disable new orchestration while retaining thread data.

## Open Questions

- Should tool calls and tool results also be materialized as visible `chat_messages` (`role=tool`) or remain hidden runtime records only?
- Do we allow more than one `generate_experience` invocation in a single user turn before terminal assistant output?
- What subset of chat history should be passed into router from `generate_experience` (latest message only vs bounded conversation window)?
- Should conversation model provider/model be hardcoded in config or dynamically changeable per environment/user cohort?
- Do we need explicit user-facing typing/progress events from conversation loop (separate from existing run/tool events)?
