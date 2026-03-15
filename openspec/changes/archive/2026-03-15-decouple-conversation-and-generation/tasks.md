## 1. Execution Contracts and Configuration

- [x] 1.1 Add conversation-loop config keys (`CONVERSATION_PROVIDER`, `CONVERSATION_MODEL`, `CONVERSATION_MAX_TOKENS`, `CONVERSATION_LOOP_ENABLED`) with startup validation and safe defaults
- [x] 1.2 Define canonical runtime contracts for `ConversationRun`, `ToolInvocationRecord`, `ToolResult`, and shared correlation ids
- [x] 1.3 Define and validate strict `generate_experience` tool result schema (`status`, generation/experience ids, `errorCode`, `errorMessage`, `sandboxStatus`)
- [x] 1.4 Add/adjust tool registry contracts so an empty tool list is valid and does not fail request execution
- [x] 1.5 Remove hardcoded runtime assistant success/failure copy from execution paths so user-facing follow-up is always model-authored

## 2. Persistence and Migration (Option A)

- [x] 2.1 Apply Option A schema changes to treat `assistant_runs` as conversation runs and add correlation fields for generation execution/tool invocation linkage
- [x] 2.2 Extend `tool_invocations` persistence schema for lifecycle state transitions, normalized errors, and timing metadata
- [x] 2.3 Extend routing telemetry persistence to store `tier`, `confidence`, `reason`, selected provider/model, and fallback metadata
- [x] 2.4 Update runtime repository read/write methods to atomically persist conversation run state plus tool/generation correlations
- [x] 2.5 Backfill/default existing records where needed so hydration and analytics remain valid for historical threads

## 3. Conversation Loop Orchestrator

- [x] 3.1 Implement a dedicated `ConversationLoopService` that owns per-turn lifecycle transitions (`queued` -> `running` -> terminal)
- [x] 3.2 Refactor `ChatRuntimeService.submitMessage` to delegate orchestration to `ConversationLoopService`
- [x] 3.3 Implement bounded context assembly for each conversation-model call (thread history, current user turn, prior tool results)
- [x] 3.4 Implement provider-native tool loop execution that continues until assistant output contains no tool calls
- [x] 3.5 Persist terminal assistant messages authored by the conversation model and link them to the owning conversation run
- [x] 3.6 Add loop guardrails (max tool rounds, timeout/cancellation handling, normalized failure states)
- [x] 3.7 Ensure toolless mode works end-to-end when no tools are registered or `generate_experience` is unavailable

## 4. `generate_experience` Tool Executor Boundary

- [x] 4.1 Move router invocation out of top-level submit flow and into `generate_experience` tool execution
- [x] 4.2 Pass prompt intent and bounded conversation context from tool args into routing and generation input builders
- [x] 4.3 Route on quality tier only (`fast`/`quality`) and map directly to configured generation models with no preferred-provider output
- [x] 4.4 Reuse generation/refinement prompt builders, payload validation, and safety checks inside the tool executor boundary
- [x] 4.5 Return normalized structured tool results for success/failure and avoid partial executable payload fields on failure
- [x] 4.6 Persist generation execution records correlated to thread, conversation run, and tool invocation ids
- [x] 4.7 Keep refinement inside the same tool path, including prior artifact validation and lineage/version linkage

## 5. Eventing, Hydration, and Sandbox Synchronization

- [x] 5.1 Extend runtime event contracts to include conversation events (`run_started`, `assistant_message_created`, `run_completed`, `run_failed`)
- [x] 5.2 Emit ordered tool lifecycle events (`tool_started`, `tool_succeeded`, `tool_failed`) with correlation fields for reducer mapping
- [x] 5.3 Emit `sandbox_updated` events for `creating`, `ready`, and `error` transitions driven by tool lifecycle
- [x] 5.4 Update hydration endpoint responses to include conversation-run metadata, active tool execution metadata, and latest sandbox snapshot
- [x] 5.5 Preserve reconnect-safe cursor ordering and snapshot reconciliation for both toolless and tool-driven runs
- [x] 5.6 Keep event payloads provider-agnostic and free of provider-native wire-format leakage

## 6. Provider-Native Tool Calling and Router Integration

- [x] 6.1 Wire the main loop to a fixed conversation provider/model path independent from generation routing decisions
- [x] 6.2 Ensure OpenAI, Anthropic, and Gemini native-tool adapters map into a single canonical internal tool request/result contract
- [x] 6.3 Ensure tool-result continuation is translated correctly back into each provider's expected native format
- [x] 6.4 Implement router output validation and deterministic fallback mapping for malformed/failed router responses
- [x] 6.5 Persist provider/model traces for debugging while preserving canonical orchestration boundaries

## 7. Frontend Integration Points

- [x] 7.1 Update frontend runtime types and reducers to represent conversation-run and tool-invocation correlated state
- [x] 7.2 Render model-authored assistant messages both before and after tool execution without hardcoded runtime copy
- [x] 7.3 Show chat loading/error UI directly from run/tool/sandbox lifecycle events (`creating`, `ready`, `error`)
- [x] 7.4 Support chat-only behavior for turns with no tool calls and environments where `generate_experience` is disabled
- [x] 7.5 Keep request payloads free of fast/quality UI inputs and rely on backend internal routing decisions
- [x] 7.6 Keep preview iframe state strictly sourced from backend sandbox state transitions/events
- [x] 7.7 Validate hydration + SSE reconciliation behavior across refresh/reconnect during mixed run types

## 8. Validation, Rollout, and Cleanup

- [x] 8.1 Add unit tests for loop termination, repeated tool rounds, and toolless fallback behavior
- [x] 8.2 Add integration tests for full flow: user turn -> conversation tool call -> router -> generation -> sandbox update -> post-tool assistant reply
- [x] 8.3 Add failure-path tests for router schema invalidity, provider timeout/refusal, and normalized tool-result handoff
- [x] 8.4 Add persistence tests verifying correlation ids and telemetry linkage across conversation/tool/generation records
- [x] 8.5 Add frontend integration tests for event ordering, hydration reconciliation, and retry after generation failure
- [x] 8.6 Add observability for conversation latency, tool-call counts, router decisions, generation latency, and failure rates
- [x] 8.7 Roll out behind feature flags and document rollback to legacy runtime path
- [x] 8.8 Remove stale legacy orchestration code only after parity checks pass in staging/production
