## 1. Canonical Types

- [x] 1.1 Add `toolCalls?: CanonicalToolCall[]` to `CanonicalChatMessage` in `tool-runtime.types.ts`
- [x] 1.2 Update `mapPersistedMessageToCanonical` in `conversation-loop.service.ts` to reconstruct `toolCalls` from `content_json.toolCalls` for assistant-role messages

## 2. Repository

- [x] 2.1 Add `createToolCallMessage` method to `ChatRuntimeRepository` — writes an `assistant`-role row with `content_json.toolCalls` containing canonical tool call array
- [x] 2.2 Add `createToolResultMessage` method to `ChatRuntimeRepository` — writes a `tool`-role row with `content` as JSON-serialised result and `content_json.toolCallId + toolName`

## 3. Conversation Loop — Write Tool Messages

- [x] 3.1 In `ConversationLoopService.executeTurn`, after receiving an LLM response with tool calls, call `createToolCallMessage` before executing any tool — persist the assistant tool-call message
- [x] 3.2 After each tool executes (success or failure), call `createToolResultMessage` with a **curated LLM-facing payload** — `{ status, operation, errorCode?, errorMessage? }` only. The full `GenerateExperienceToolResult` (IDs, route, sandboxStatus) continues to be written to `tool_invocations.tool_result` unchanged; this is a separate write for a separate audience

## 4. Conversation Loop — History Building

- [x] 4.1 Remove the `.filter((message) => message.role !== 'tool')` line from `buildConversationMessages`
- [x] 4.2 Implement boundary-safe context windowing: after slicing to the configured window size, snap the window start backward to the nearest `role: 'user'` message to avoid starting mid-tool-exchange

## 5. Anthropic Adapter

> **Note for implementor**: Before making changes, verify the exact message format requirements in the [Anthropic tool use documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use). Confirm that `tool_use` blocks must appear in assistant messages and `tool_result` blocks must appear in user messages immediately following, and that no messages may appear between them.

- [x] 5.1 Update `buildAnthropicToolRequest` to detect assistant messages with `toolCalls` in the canonical history and convert them to Anthropic `tool_use` content blocks
- [x] 5.2 Update `buildAnthropicToolRequest` to detect `role: 'tool'` messages in the canonical history and convert them to Anthropic `tool_result` user content blocks with the correct `tool_use_id`
- [x] 5.3 Remove the `providerContinuation.anthropic.pendingToolCalls` path from `buildAnthropicToolRequest` once history-driven reconstruction is confirmed working
- [x] 5.4 Stop emitting `providerContinuation.anthropic` from the Anthropic adapter response

## 6. Gemini Adapter

> **Note for implementor**: Before making changes, verify the exact message format requirements in the [Gemini function calling documentation](https://ai.google.dev/gemini-api/docs/function-calling). Confirm that `functionCall` parts appear in model turns and `functionResponse` parts appear in user turns immediately following, and that function call IDs must be matched correctly.

- [x] 6.1 Update `buildGeminiToolRequest` to detect assistant messages with `toolCalls` in the canonical history and convert them to Gemini `functionCall` model turns
- [x] 6.2 Update `buildGeminiToolRequest` to detect `role: 'tool'` messages in the canonical history and convert them to Gemini `functionResponse` user turns with the correct function name
- [x] 6.3 Remove the `providerContinuation.gemini.pendingToolCalls` path from `buildGeminiToolRequest` once history-driven reconstruction is confirmed working
- [x] 6.4 Stop emitting `providerContinuation.gemini` from the Gemini adapter response

## 7. OpenAI Adapter

> **Note for implementor**: Before making changes, verify the OpenAI Responses API documentation on `previous_response_id`. Specifically confirm: (a) whether stored responses have a server-side TTL or are retained indefinitely, (b) whether `previous_response_id` can be safely reused across separate HTTP request lifetimes (i.e. different user turns or a future confirmation-resume flow), and (c) the correct input format for including prior tool call history in a stateless (no `previous_response_id`) request. Document your findings in a code comment. The outcome of this investigation determines whether the OpenAI adapter should pursue stateful ID chaining or stateless full-history reconstruction.

- [x] 7.1 Investigate OpenAI Responses API `previous_response_id` lifetime and cross-request reuse (see note above) and document decision in code
- [x] 7.2 Update `buildOpenAiToolRequest` based on findings: either implement stateless full-history reconstruction using canonical tool call/result messages, or implement persisted `previous_response_id` chaining for cross-turn continuation
- [x] 7.3 Ensure the stateless (no `previous_response_id`) input path in `buildOpenAiToolRequest` correctly represents prior tool call history in the format required by the Responses API

## 8. Type Cleanup

- [x] 8.1 Remove `pendingToolCalls` from `ProviderContinuationState.anthropic` in `tool-runtime.types.ts`
- [x] 8.2 Remove `pendingToolCalls` from `ProviderContinuationState.gemini` in `tool-runtime.types.ts`
- [x] 8.3 Remove `ProviderContinuationState.anthropic` and `ProviderContinuationState.gemini` entirely if no other fields remain after cleanup

## 9. Tests

- [x] 9.1 Update `conversation-loop.service.spec.ts` to assert that tool-call and tool-result messages are written to the repository after each tool execution
- [x] 9.2 Update `tool-adapter.contract.spec.ts` to verify Anthropic and Gemini adapters correctly build provider-native blocks from canonical history rather than from continuation state
- [x] 9.3 Add a test for boundary-safe windowing: assert that a window that would start mid-tool-exchange is snapped to the preceding user message
- [x] 9.4 Verify that existing multi-round tool loop tests still pass end-to-end
