## 1. Data Model and Contract Foundations

- [x] 1.1 Add Supabase migration for `chat_threads`, `chat_messages`, `assistant_runs`, `tool_invocations`, and `sandbox_states` with required indexes and foreign keys
- [x] 1.2 Generate/update backend Supabase typings to include new chat/runtime tables
- [x] 1.3 Define canonical runtime TypeScript types for messages, runs, tool calls, events, and sandbox state
- [x] 1.4 Add shared runtime enums for statuses (`queued`, `running`, `succeeded`, `failed`, `cancelled`) and sandbox states (`empty`, `creating`, `ready`, `error`)
- [x] 1.5 Add idempotency key persistence and uniqueness constraints for message submission

## 2. Backend Chat Runtime Modules

- [x] 2.1 Create NestJS modules/controllers/services for threads, messages, runs, and sandbox state
- [x] 2.2 Implement thread creation and hydration endpoint returning thread metadata, ordered messages, sandbox snapshot, and active run state
- [x] 2.3 Implement message submission endpoint that atomically persists user message and creates assistant run
- [x] 2.4 Implement per-thread run concurrency guard (single active run policy or queued policy as finalized)
- [x] 2.5 Implement idempotent message submission behavior using client-provided idempotency keys

## 3. Provider Adapter Layer and Native Tool Loop

- [x] 3.1 Refactor LLM abstraction to support canonical chat+tool inputs and outputs (beyond raw structured text)
- [x] 3.2 Implement OpenAI adapter for native tool-calling with canonical translation boundaries
- [x] 3.3 Implement Anthropic adapter for native tool-calling with canonical translation boundaries
- [x] 3.4 Implement Gemini adapter for native tool-calling with canonical translation boundaries
- [x] 3.5 Persist provider raw request/response payload traces linked to assistant runs for debugging
- [x] 3.6 Implement provider adapter contract tests with shared fixtures across all configured providers

## 4. Router Stage and Dispatch Policy

- [x] 4.1 Add router service that invokes a lightweight LLM and validates structured routing output
- [x] 4.2 Extend configuration service to map router decision (`tier` and optional provider hint) to concrete provider/model
- [x] 4.3 Implement fallback route behavior when router output is invalid or router call fails
- [x] 4.4 Persist router decision telemetry in assistant run records (decision payload, confidence, fallback reason)
- [x] 4.5 Remove client-facing quality-mode requirement from chat message execution contracts

## 5. Tool Executor and Artifact Integration

- [x] 5.1 Implement tool registry and executor boundary for `generate_experience` and refinement operation path
- [x] 5.2 Reuse existing prompt builder, payload validation, safety guard, and artifact persistence inside tool executor
- [x] 5.3 Persist tool invocation lifecycle transitions and correlate each invocation to thread/run/provider call ids
- [x] 5.4 Update sandbox state transitions from tool lifecycle (`empty` -> `creating` -> `ready` / `error`)
- [x] 5.5 Ensure successful tool output writes/links `experiences` and `experience_versions` with lineage continuity

## 6. API Surface and Event Streaming

- [x] 6.1 Implement SSE endpoint for runtime events (`run_started`, `tool_started`, `tool_succeeded`, `tool_failed`, `assistant_message_created`, `sandbox_updated`, `run_failed`)
- [x] 6.2 Implement event ordering/cursor support for reconnect-safe frontend consumption
- [x] 6.3 Implement snapshot reconciliation path for reconnect/refresh hydration
- [x] 6.4 Normalize runtime error payloads for API responses and event stream events
- [x] 6.5 Add compatibility guard around legacy `/api/experiences/generate` and `/api/experiences/refine` endpoints during transition

## 7. Frontend Chat + Sandbox Cutover

- [x] 7.1 Replace form-driven generate/refine controls with thread-based chat timeline and composer
- [x] 7.2 Implement frontend hydration bootstrapping from thread snapshot endpoint
- [x] 7.3 Implement frontend event reducer to process SSE runtime events into chat and sandbox UI state
- [x] 7.4 Bind right-pane iframe preview strictly to backend `sandbox_state` and active artifact payload
- [x] 7.5 Remove fast/quality toggle from UI and stop sending quality mode in request payloads
- [x] 7.6 Replace local recent-history-first UX with backend thread/message history rendering
- [x] 7.7 Implement frontend retry flows for failed runs/tool invocations through chat interactions

## 8. Validation, Observability, and Rollout

- [x] 8.1 Add end-to-end tests for thread flow: message submit -> router -> native tool call -> sandbox update -> assistant reply
- [x] 8.2 Add tests for invalid router output fallback and provider-native tool failure normalization
- [x] 8.3 Add tests for idempotent message submission and reconnect hydration consistency
- [x] 8.4 Add metrics/logging dashboards for router decisions, provider/model distribution, run latency, and tool failure rates
- [x] 8.5 Execute staged rollout with feature flags (`CHAT_RUNTIME_ENABLED`, `NATIVE_TOOL_LOOP_ENABLED`, `ROUTER_STAGE_ENABLED`)
- [x] 8.6 Deprecate old frontend paths and retire legacy generate/refine API usage after parity validation
- [x] 8.7 Update backend/frontend docs and operational runbooks for chat-first architecture
