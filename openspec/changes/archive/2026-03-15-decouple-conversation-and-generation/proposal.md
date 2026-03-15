## Why

Monti's current chat runtime still hardcodes key assistant responses around tool execution, which prevents truly conversational behavior and keeps generation orchestration tightly coupled to the main chat flow. We need a model-led conversational loop that can operate as a normal chat assistant even when no generation tools are available, while delegating experience creation to a separate engine boundary.

## What Changes

- Introduce a dedicated conversation loop model (fixed provider/model) that owns assistant messaging and tool-calling decisions for each user turn.
- Move `generate_experience` orchestration into a tool executor boundary so routing, model selection, generation, sandbox updates, and result normalization happen inside the tool path.
- Replace hardcoded success/failure assistant strings with model-generated post-tool responses based on structured tool results.
- Split runtime tracking into conversation-loop lifecycle and generation-engine lifecycle with correlation metadata for observability and replay.
- Keep the app functional as a standard chat assistant when generation tools are absent or disabled (no special-case failures from the conversation layer).
- **BREAKING**: Chat runtime execution contract changes from "submit message immediately runs generation flow" to "submit message runs conversation tool loop; generation is optional and tool-driven."

## Capabilities

### New Capabilities
- `conversation-tool-loop`: Fixed-model conversational orchestration that continues until no more tool invocations remain, with model-authored assistant responses before/after tool usage.

### Modified Capabilities
- `chat-thread-runtime`: Run semantics and event lifecycle now include conversation-loop progression and tool-result handoff boundaries.
- `native-provider-tool-calling`: Native tool-calling becomes the primary conversational loop mechanism for the constant conversation model.
- `llm-routing-decision`: Router stage moves under `generate_experience` tool execution rather than top-level message submission.
- `experience-generation`: Generation execution is invoked via tool context and returns structured tool result contracts to the conversation model.
- `experience-refinement`: Refinement execution follows the same tool-result contract and conversational handoff semantics.
- `thread-sandbox-sync`: Sandbox updates remain generation-driven but must be emitted and reconciled in tandem with conversation-loop events.
- `experience-persistence`: Persistence must capture linkage between conversation runs, generation runs, tool invocations, and assistant messages.
- `experience-preview-history`: UI behavior shifts to model-authored conversational confirmations/errors instead of hardcoded runtime strings.

## Impact

- Backend runtime orchestration in `chat-runtime` services/controllers/repository contracts.
- LLM adapter usage: fixed conversation model path + router/model dispatch inside tool executor path.
- Data model and telemetry: additional run-correlation fields and potentially new conversation run lifecycle storage.
- SSE and frontend reducer logic for conversation/tool/sandbox event interplay.
- Operational metrics/dashboards and failure-mode handling for dual-loop execution.
