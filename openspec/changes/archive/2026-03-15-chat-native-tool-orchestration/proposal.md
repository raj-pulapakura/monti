## Why

Monti's next product direction makes chat messages the core primitive, with experience generation/refinement executed as tools and surfaced in a synchronized sandbox pane. The current generate/refine form API and UI architecture is optimized for single-shot requests, so it cannot cleanly support provider-native tool loops, threaded state, and run-level lifecycle updates required by the new chat-first workflow.

## What Changes

- Introduce a thread-based chat orchestration backend where user and assistant interactions are persisted as messages, and assistant turns are executed as explicit runs.
- Convert "generate experience" from direct endpoint business logic into a tool executor invoked from assistant runs.
- Add provider-native tool-calling adapters for supported LLM providers so tool execution uses each provider's native semantics while preserving a canonical internal runtime/event model.
- Add an LLM-based internal routing step (cheap/fast router model) that decides generation tier/provider selection before the main assistant/tool turn.
- Remove UI-facing fast/quality control; routing becomes internal backend policy.
- Add streaming run/tool/sandbox lifecycle events for chat UI status rendering and real-time sandbox updates.
- Add thread-coupled sandbox state persistence so the right pane reflects the latest artifact state for a thread (`empty`, `creating`, `ready`, `error`).
- Restructure frontend from form-driven generate/refine flows to a two-pane chat + sandbox flow with thread hydration, optimistic message append, and event-driven updates.
- **BREAKING**: Deprecate `/api/experiences/generate` and `/api/experiences/refine` as primary product APIs in favor of thread/message/run APIs.

## Capabilities

### New Capabilities
- `chat-thread-runtime`: Thread/message/run persistence and lifecycle APIs for chat-first orchestration.
- `native-provider-tool-calling`: Provider adapters for native tool-calling request/response loops and canonical event emission.
- `llm-routing-decision`: Internal cheap-model router that selects tier/provider for each assistant run.
- `thread-sandbox-sync`: Thread-scoped sandbox materialization and real-time preview state synchronization.

### Modified Capabilities
- `experience-generation`: Generation behavior shifts from direct generate endpoint semantics to tool invocation within assistant runs.
- `experience-refinement`: Refinement behavior shifts from dedicated refine endpoint semantics to chat/tool-driven iteration in-thread.
- `experience-persistence`: Persistence model expands beyond experience/version storage to include chat/runtime/tool/sandbox tables and run state transitions.
- `experience-preview-history`: Frontend state model changes from local prompt controls and local recent-history-first UX to thread-hydrated chat timeline plus sandbox event sync.

## Impact

- Backend modules: substantial refactor/new modules for chat threads, runs, tools, routing, provider adapter abstraction, SSE eventing, and deprecation/compat of experience endpoints.
- Data model: new normalized tables for chat/runtime/tool/sandbox domains; migration and backfill strategy required alongside existing experience/version artifacts.
- API surface: new thread/message/run/event endpoints and contracts; frontend integration must move to thread/event reducers.
- Provider integration: adapter contract and conformance tests required for OpenAI/Anthropic/Gemini native tool behavior parity.
- Observability: run/tool/router decisions and provider raw payload traces need structured persistence/logging for debugging and replay.
- Frontend architecture: major replacement of current form-based page flow with chat loop, lifecycle status rows, and sandbox state binding.
