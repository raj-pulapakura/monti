## Why

Tool call exchanges — the assistant's decision to invoke a tool and the result returned — are never persisted to `chat_messages`. They exist only in-memory during a single conversation loop execution and are discarded when the loop terminates. This means every follow-up user message starts a new loop with an incomplete message history: the LLM sees user and assistant text turns but not the tool exchanges that happened between them. All three provider APIs (Anthropic, OpenAI, Gemini) require the full tool exchange in history for technically correct multi-turn behaviour; the system works today only because models are robust enough to infer what happened from surrounding text.

## What Changes

- Persist assistant tool-call messages to `chat_messages` (role `assistant`, `content_json.toolCalls`) immediately after the LLM emits a tool call in the conversation loop
- Persist tool-result messages to `chat_messages` (role `tool`, `content_json.toolCallId + toolName`) immediately after each tool executes
- Extend `CanonicalChatMessage` with a `toolCalls` field to represent assistant messages that contain tool calls
- Update `mapPersistedMessageToCanonical` to reconstruct tool-call assistant messages from `content_json.toolCalls`
- Update `buildConversationMessages` to include tool-role messages in conversation history (remove the existing filter) and add boundary-safe context windowing so the window never starts mid-tool-exchange
- Update Anthropic and Gemini provider adapters to build provider-specific tool call/result blocks from canonical message history rather than from `providerContinuation.pendingToolCalls`
- Investigate and update the OpenAI Responses API adapter: determine whether `previous_response_id` should be persisted and chained across user turns (stateful approach) or whether a stateless full-history path is needed for cross-turn scenarios
- Remove `providerContinuation.anthropic.pendingToolCalls` and `providerContinuation.gemini.pendingToolCalls` once replaced by history-driven reconstruction; `providerContinuation.openai.previousResponseId` disposition determined by investigation

## Capabilities

### New Capabilities

- `tool-call-message-persistence`: Persisting assistant tool-call messages and tool-result messages to `chat_messages`, making the full conversational exchange durable and replayable from the database

### Modified Capabilities

- `conversation-tool-loop`: `buildConversationMessages` must include tool-role messages and apply boundary-safe windowing; the loop must write tool messages at the right points during execution
- `native-provider-tool-calling`: Provider adapters must reconstruct provider-specific tool call and result blocks from canonical message history rather than from in-memory continuation state

## Impact

- `chat_messages` table: two new message types written per tool call (no schema migration needed — `role: 'tool'` is already in the check constraint and `content_json` carries the tool call metadata)
- `CanonicalChatMessage` type and `mapPersistedMessageToCanonical` function
- `ConversationLoopService`: new DB writes after tool call received and after tool executes
- `ChatRuntimeRepository`: new repository methods for tool-call and tool-result message creation
- `buildAnthropicToolRequest`, `buildGeminiToolRequest`, `buildOpenAiToolRequest`: message-building logic updated
- `ProviderContinuationState` type: `pendingToolCalls` fields removed after migration
- No changes to `tool_invocations` table, `assistant_runs` table, billing, or SSE event system
