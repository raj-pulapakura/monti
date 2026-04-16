## Context

The conversation loop (`ConversationLoopService`) builds a `canonicalMessages` array in-memory each run. When the LLM returns tool calls, the adapter reconstructs the assistant tool-call message from `providerContinuation.pendingToolCalls` (Anthropic/Gemini) or `previous_response_id` (OpenAI) for the next round within the same run. When the run terminates, all of this state is discarded. The next user message starts a fresh run: `buildConversationMessages` loads from `chat_messages` (user + assistant text only) and the tool exchange is gone.

All three provider APIs are stateless per-request (or stateful only within a single response session for OpenAI) and require the full tool exchange in message history to maintain coherent multi-turn conversations. The `chat_messages` table already supports `role: 'tool'` in its check constraint and `content_json` for metadata — nothing needs to be added to the schema.

## Goals / Non-Goals

**Goals:**
- Tool-call and tool-result messages are durably written to `chat_messages` during every conversation loop execution
- `buildConversationMessages` produces a complete, correct message history including tool exchanges for all three providers
- Provider adapters build provider-specific tool call/result blocks from canonical message history rather than from in-memory continuation state
- `providerContinuation.pendingToolCalls` for Anthropic and Gemini is eliminated
- Context window windowing never starts mid-tool-exchange

**Non-Goals:**
- No changes to `tool_invocations` table structure or its role as the billing/operational anchor
- No changes to `assistant_runs`, SSE events, or the billing system
- Not implementing the generation confirmation gate (this groundwork enables it but does not build it)

## Decisions

### Decision: Write tool-call message and tool-result message as separate `chat_messages` rows

The assistant turn that includes tool calls and the subsequent tool result are two distinct message roles in every provider's API. Storing them as separate rows (one `role: assistant` with `content_json.toolCalls`, one `role: tool` with `content_json.toolCallId + toolName`) maps cleanly to the canonical message type, keeps row semantics simple, and mirrors how user and assistant text messages are already stored.

Alternative considered: a single combined row per tool exchange. Rejected because it conflates the assistant turn (LLM output) with the tool result (system output) into one record, making reconstruction and ordering ambiguous.

### Decision: Store tool calls in canonical form in `content_json`, not provider-native form

`content_json.toolCalls` holds `[{ id, name, arguments }]` — the `CanonicalToolCall` shape. Provider adapters convert this to Anthropic `tool_use` blocks, Gemini `functionCall` parts, or OpenAI `function_call` items at request-build time.

Alternative considered: storing the raw provider response JSON. Rejected because it couples persistence to a specific provider's format and makes switching providers or replaying history across providers impossible.

### Decision: Extend `CanonicalChatMessage` with optional `toolCalls` field rather than a new message type

Adding `toolCalls?: CanonicalToolCall[]` to the existing interface keeps the type surface minimal and matches how providers model it (an assistant message optionally contains tool calls alongside text). The `role` field remains `'assistant'`.

### Decision: Boundary-safe context windowing — snap to nearest preceding user message

When slicing `canonicalMessages` to the configured context window size, the slice must not begin inside a tool exchange (assistant tool-call → tool result pair). The window start is snapped backward to the nearest `role: 'user'` message boundary. This ensures the LLM always receives complete, valid exchanges.

### Decision: Anthropic and Gemini drop `pendingToolCalls` continuation; reconstruct from message history

With tool-call and tool-result messages now in `chat_messages`, the message history passed to the adapter is complete. `buildAnthropicToolRequest` and `buildGeminiToolRequest` can detect assistant messages with `toolCalls` in the history and build the provider-specific blocks directly, removing dependence on `providerContinuation.pendingToolCalls`. This makes intra-run and cross-turn reconstruction identical.

### Decision: Tool result message content is a curated LLM-facing subset, not the full operational result

`GenerateExperienceToolResult` contains operational fields (`generationId`, `experienceId`, `experienceVersionId`, `sandboxStatus`, `route`) intended for the system — billing, SSE events, correlation — not for the LLM. Sending this wholesale wastes tokens and exposes internal plumbing to the model.

Critically, HTML/CSS/JS from prior generations is never in the tool result and never passes through the conversational model. For refinements, `GenerateExperienceToolService` fetches the active experience directly from `sandbox_states` and passes it to the generation orchestrator itself. The conversational model is intentionally kept out of that data flow.

The tool-result message persisted to `chat_messages` (and therefore sent to the LLM) MUST contain only what the model needs to generate its response:

```json
// success
{ "status": "succeeded", "operation": "generate" }

// failure  
{ "status": "failed", "operation": "generate", "errorCode": "...", "errorMessage": "..." }
```

The full `GenerateExperienceToolResult` continues to be written to `tool_invocations.tool_result` for operational purposes, unchanged. These are two separate writes serving two separate audiences.

### Decision: OpenAI `previous_response_id` — investigate before deciding

The OpenAI Responses API is stateful within a response session via `previous_response_id`. The current adapter uses this for intra-run tool continuation (only sending `function_call_output` items, not full history). Whether this ID can be persisted and chained across user turns (avoiding full history reconstruction for OpenAI) or whether a stateless full-history path should replace it is an open question requiring documentation verification before implementation. See Open Questions.

## Risks / Trade-offs

**Increased DB write volume** → Each tool call now produces two additional `chat_messages` inserts per execution. For the current usage pattern (one `generate_experience` call per run), this is two extra rows per generation. Negligible at current scale; acceptable trade-off for correctness.

**Context window growth** → Including tool-call and tool-result messages in history increases token usage per turn. Tool result payloads are small by design (see Decision below) so growth is bounded. The boundary-safe windowing handles the rest.

**providerContinuation removal is a breaking internal change** → Removing `pendingToolCalls` from `ProviderContinuationState` changes the adapter contract. All three adapters and any tests relying on continuation must be updated atomically. No external API surface is affected.

**OpenAI adapter is the most uncertain** → The OpenAI Responses API's stateful continuation model is architecturally different from Anthropic/Gemini. Implementation of the OpenAI adapter update should be the last step and validated against the live API before merging.

## Migration Plan

No database migration required — `chat_messages` already supports `role: 'tool'` and `content_json`.

The change is purely additive at the DB level: new rows start being written once the code deploys. Existing threads will have incomplete history for turns prior to deployment (their tool exchanges were never persisted), but this is acceptable — the LLM will continue to infer context from surrounding text for those historical turns, as it does today.

No rollback complexity: reverting the code deployment stops writing the new message types. Existing rows with `role: 'tool'` or assistant rows with `content_json.toolCalls` are harmless if the filter is reinstated.

## Open Questions

**OpenAI `previous_response_id` persistence scope**: Does OpenAI store responses server-side indefinitely, or is there a TTL? Can `previous_response_id` be safely persisted to `assistant_runs.content_json` and reused across separate HTTP requests (different user turns, or the future confirmation resume path)? The implementor must verify this against the OpenAI Responses API documentation before deciding whether to pursue stateful chaining or stateless full-history reconstruction for OpenAI.
