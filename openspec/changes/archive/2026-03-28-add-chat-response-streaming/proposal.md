## Why

Monti already streams run and tool lifecycle events, but assistant replies still appear only after the full conversation turn completes. That makes chat feel stalled during longer generations and hides useful progress from the user even though the runtime already maintains a live event channel.

The current streaming proposal also improves runtime responsiveness without fully locking in the visual and interaction quality of those states. The chat draft, loading, reconnecting, and preview-waiting moments need an explicit design-language contract so the streamed experience feels intentional, warm, and enjoyable rather than merely functional.

## What Changes

- Extend the chat runtime event contract so assistant replies can be streamed incrementally over the existing thread event stream instead of appearing only after final persistence.
- Change conversation-turn execution to return control to the submit API without waiting for the full assistant turn to finish, allowing the frontend to stay connected to live progress.
- Update provider-native conversation adapters to support incremental assistant text and tool-call accumulation instead of only final whole-response parsing.
- Add frontend reducer and rendering support for ephemeral in-progress assistant content that is reconciled with the final persisted assistant message.
- Add polished chat and preview state treatments for draft streaming, submit acknowledgement, long-running waits, reconnecting, and failure recovery using the existing Sunlit Atelier design language.
- Preserve immutable persisted chat messages by treating streamed assistant text as transient runtime state until completion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-thread-runtime`: Runtime events and thread UX must support incremental assistant output, transient draft state, and completion reconciliation.
- `native-provider-tool-calling`: Provider adapter and orchestration contracts must support streaming assistant output while preserving canonical tool-loop behavior.
- `sunlit-atelier-design-language`: Shared loading, streaming, reconnecting, and recovery states must define the visual and motion contract for streamed chat interactions.
- `experience-preview-history`: The preview pane must present generation waits, handoffs, and failures with polished creator-centered state treatments that stay aligned with streamed chat progress.

## Impact

- Backend chat runtime: submit-message flow, event publishing, conversation-loop execution, and runtime event typing.
- Provider integrations: OpenAI, Anthropic, and Gemini conversation adapters and their shared canonical tool-runtime interfaces.
- Frontend chat runtime: SSE event handling, reducer state, optimistic/draft message rendering, scroll behavior, submit/loading state semantics, and elevated chat/preview feedback styling.
- Shared web UI system: loading placeholders, motion-safe status treatments, streaming-state copy, and chat/preview presentation primitives in the Sunlit Atelier language.
- Tests and specs: runtime event service tests, conversation-loop tests, frontend reducer tests, and OpenSpec capability deltas.
