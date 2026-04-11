## 1. System Prompt Hardening

- [x] 1.1 Draft the redirect-not-refuse topic-restriction language to append to `LLM_RUNTIME_CONFIG.conversation.systemPrompt` in `llm-config.service.ts` (coordinate with UX for exact wording)
- [x] 1.2 Update `LLM_RUNTIME_CONFIG.conversation.systemPrompt` default in `llm-config.service.ts` with the agreed topic-restriction language

## 2. Sliding Window Context Management

- [x] 2.1 Add `conversationContextWindowSize` field to `LlmConfigService` backed by `CONVERSATION_CONTEXT_WINDOW_SIZE` env var using `readPositiveInt` with default of 20
- [x] 2.2 Update `buildConversationMessages()` in `conversation-loop.service.ts` to slice `filteredMessages` to the last `conversationContextWindowSize` entries before prepending the system prompt

## 3. Verification

- [x] 3.1 Write unit tests for the sliding window: thread shorter than window includes all messages; thread longer than window includes only the last N; system prompt is always prepended; invalid env var falls back to default
- [ ] 3.2 Manually verify topic restriction: send an off-topic prompt (e.g., "write me a poem") and confirm the model redirects rather than complies; send an adjacent question (e.g., "what makes a good quiz?") and confirm it is answered normally
- [ ] 3.3 Verify rollback paths: set `CONVERSATION_SYSTEM_PROMPT` to the old prompt text and confirm original behavior; set `CONVERSATION_CONTEXT_WINDOW_SIZE=9999` and confirm no truncation occurs
