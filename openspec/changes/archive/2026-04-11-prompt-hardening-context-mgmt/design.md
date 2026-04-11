## Context

The conversation model (`gpt-5.4`, `LLM_RUNTIME_CONFIG.conversation`) drives every back-and-forth turn in a Monti chat thread. Two issues compound as a thread grows:

1. **No topic restriction**: The system prompt (`LlmConfigService.conversationSystemPrompt`) is purely operational — it tells the model how to use tools, not what subjects to cover. A user with credits can direct the conversation toward arbitrary topics (essay writing, personal code debugging, trivia), consuming tokens at the platform's cost with no relation to experience building.

2. **Unbounded context**: `buildConversationMessages()` in `ConversationLoopService` fetches the full thread history and sends every message on every turn. For a 100-message thread, each turn sends the entire 100-message transcript. Input token cost grows linearly with thread length regardless of how old the messages are.

The two problems are independent but live at the same insertion point (`buildConversationMessages`), so they are addressed together.

## Goals / Non-Goals

**Goals:**
- Restrict the conversation model to educational experience design topics via system prompt hardening; off-topic requests are redirected, not hard-refused.
- Cap the number of historical messages sent to the conversation model per turn to a configurable sliding window (last N messages).
- Keep both controls configurable via environment variables so limits can be adjusted without a deploy.

**Non-Goals:**
- Server-side LLM classification or monitoring of user intent (system prompt hardening is the sole enforcement mechanism for v1).
- Summarizing or compressing dropped context messages before truncation (adds complexity; dropped messages remain in the DB and are not lost).
- Gating or throttling based on total thread length (separate concern from context management).
- Any change to the experience-generation LLM call path or its prompts.

## Decisions

### Decision 1: Redirect-not-refuse system prompt hardening

**Choice:** Extend the existing `conversationSystemPrompt` default (in `LLM_RUNTIME_CONFIG.conversation.systemPrompt`) with a topic-restriction paragraph that instructs the model to politely steer off-topic requests back to experience building rather than issuing hard refusals.

**Why redirect over refuse:** Hard refusals ("I can't help with that") create friction on legitimate adjacent questions — e.g., "what makes a good quiz layout?" is adjacent to experience design and should be answered. Redirect language ("That's outside my focus area; let me help you design an experience that covers that instead") handles the genuine off-topic cases while being permissive for edge cases that are actually useful.

**Why system prompt only (no classifier):** A server-side LLM classifier adds a round-trip, cost, and latency to every turn. The model already reads the system prompt before generating; instructing it there is zero-cost. For v1, system prompt hardening is sufficient. If bypass patterns emerge, a classifier can be layered in later.

**Alternative considered:** Regex/keyword blocklist. Rejected — too brittle (misses paraphrases, catches legitimate text) and requires ongoing maintenance.

**Implementation:** The updated system prompt default is set in `LLM_RUNTIME_CONFIG.conversation.systemPrompt`. Since `conversationSystemPrompt` is already overridable via `CONVERSATION_SYSTEM_PROMPT` env var, operators can tweak the prompt without a code change.

### Decision 2: Sliding window truncation in `buildConversationMessages`

**Choice:** After fetching and filtering messages (tool messages are already excluded), slice `filteredMessages` to the last `conversationContextWindowSize` entries before prepending the system prompt. The system prompt is always included.

**Why this insertion point:** `buildConversationMessages` is the single place where thread history is assembled into the LLM request. All conversation turns flow through it. Truncating here requires no changes downstream.

**Why count messages, not tokens:** A token-counting approach would be more precise but requires a tokenizer round-trip (or approximation) per message. Message count is simple, predictable, and sufficient — each message is bounded by `conversationMaxTokens`, so `N × maxTokens` gives a reliable worst-case bound.

**No summarization for v1:** Prepending a rolling summary of dropped context adds meaningful complexity (a second LLM call or a separate summarization pipeline). The benefit is marginal — most conversational context required to continue experience design is recent. Dropped messages remain in the DB; the user can reference them in the UI.

**Alternative considered:** Token-budget-based truncation. Rejected for v1 — adds tokenizer dependency and complexity without meaningfully better outcomes at the default window size.

### Decision 3: `CONVERSATION_CONTEXT_WINDOW_SIZE` env var in `LlmConfigService`

**Choice:** Add a `conversationContextWindowSize` field to `LlmConfigService` backed by the `CONVERSATION_CONTEXT_WINDOW_SIZE` env var, using `readPositiveInt` (already in scope), defaulting to 20.

**Why 20:** A typical thread of 20 messages represents 10 back-and-forth exchanges — ample context for experience design continuity. At the conversation model's `maxTokens` of 4096/message, worst case is ~80k tokens of input context, well within model context limits.

**Why env var:** Consistent with how all other conversation model config is exposed (`CONVERSATION_MODEL`, `CONVERSATION_MAX_TOKENS`, etc.). Allows tuning in production without a deploy.

## Risks / Trade-offs

- **Prompt bypass via jailbreaks** → System prompt hardening is not adversarial-proof. A determined user can likely coax general responses with carefully crafted prompts. Mitigation: redirect language is softer, so attempts that partially succeed still stay somewhat on-topic. Server-side classification can be added later if this becomes a material problem.

- **Abrupt context loss at window boundary** → A user who refers back to a conversation point older than N messages will find the model unaware of it. Mitigation: N=20 is generous for typical experience-design sessions; the messages remain visible in the UI, so the user can restate context if needed.

- **Window size misconfiguration** → Setting `CONVERSATION_CONTEXT_WINDOW_SIZE` very low (e.g., 2) could break conversational continuity. Mitigation: `readPositiveInt` rejects non-positive values; documentation should recommend a minimum of 10.

## Migration Plan

1. Update `LLM_RUNTIME_CONFIG.conversation.systemPrompt` default with topic-restriction language.
2. Add `conversationContextWindowSize` field to `LlmConfigService` with `readPositiveInt` and `CONVERSATION_CONTEXT_WINDOW_SIZE` env var.
3. Update `buildConversationMessages()` to slice `filteredMessages` to the last `conversationContextWindowSize` entries.
4. Deploy; no DB migrations, no frontend changes, no API contract changes.

**Rollback:** System prompt can be reverted via `CONVERSATION_SYSTEM_PROMPT` env var without a code deploy. Window size can be set to a very large value (e.g., 9999) via `CONVERSATION_CONTEXT_WINDOW_SIZE` to effectively disable truncation.

## Open Questions

- What is the exact wording of the redirect language in the system prompt? (Needs UX review before deploy — the implementation can use a placeholder.)
- Should `CONVERSATION_CONTEXT_WINDOW_SIZE` have a documented minimum and emit a warning when set below, say, 10?
