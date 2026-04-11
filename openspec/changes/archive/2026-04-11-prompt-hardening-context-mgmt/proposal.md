## Why

The conversation LLM runs on every user turn with no topic restrictions and no cap on how much history it receives. Users with credits can treat Monti as a general-purpose chatbot (essays, personal code help, trivia), burning token budget the platform pays for. Independently, thread history grows unboundedly — a long conversation sends the entire transcript on every turn, driving input token costs up with each message.

## What Changes

- Add a topic-restriction system prompt layer to the conversation model that redirects off-topic requests back to educational experience design, without hard-refusing adjacent questions that legitimately inform experience creation.
- Add a configurable sliding-window context truncation in `buildConversationMessages()` so only the last N messages are sent to the model per turn (older messages stay in the DB; the system prompt is always included).
- Expose the window size as a configurable value (`CONVERSATION_CONTEXT_WINDOW_SIZE`, default 20) alongside the existing conversation model config in `LlmConfigService`.

## Capabilities

### New Capabilities

- `conversation-topic-restriction`: System prompt hardening that steers the conversation model to stay within educational experience design topics. Uses redirect-not-refuse phrasing to handle edge cases gracefully.
- `conversation-context-window`: Sliding-window truncation of thread history sent to the conversation model per turn, capping input token growth on long threads.

### Modified Capabilities

<!-- No existing spec-level behavior changes — this adds new constraints to the conversation model internals, not user-facing feature contracts. -->

## Impact

- `backend/src/llm/llm-config.service.ts` — system prompt updated; new `conversationContextWindowSize` config field added
- `backend/src/chat-runtime/services/conversation-loop.service.ts` — `buildConversationMessages()` truncated to sliding window
- No API contract changes, no DB schema changes, no frontend changes
- Token cost per turn capped once window kicks in; slight behavior change for users with very long threads (old context dropped)
