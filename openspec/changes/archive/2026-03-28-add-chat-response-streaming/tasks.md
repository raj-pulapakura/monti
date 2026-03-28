## 1. Backend Runtime Streaming Contract

- [x] 1.1 Extend chat runtime event types, DTO handling, and event publishing to support `assistant_message_started` and `assistant_message_updated` alongside the existing persisted assistant event.
- [x] 1.2 Decouple message submission from terminal turn completion so the submit API returns the accepted user message and current run state before assistant generation finishes.
- [x] 1.3 Update the conversation loop to publish transient assistant draft events during execution and reconcile them with final persisted assistant messages on completion or failure.

## 2. Provider Adapter Streaming Support

- [x] 2.1 Extend the canonical tool-runtime interfaces so provider adapters can emit normalized assistant draft callbacks while still returning a final canonical turn result.
- [x] 2.2 Implement streaming assistant output accumulation for the OpenAI native tool adapter, including coalesced draft updates and final tool-call normalization.
- [x] 2.3 Implement streaming assistant output accumulation for the Anthropic and Gemini native tool adapters with the same canonical callback behavior.

## 3. Frontend Draft Rendering

- [x] 3.1 Extend frontend runtime state and reducer logic to track a transient assistant draft separately from persisted chat messages.
- [x] 3.2 Update the chat thread page SSE handling and message rendering so assistant drafts stream into the conversation, reconcile on `assistant_message_created`, and keep the latest content in view.
- [x] 3.3 Separate short-lived submit acknowledgement state from longer-running assistant progress state in the composer and related loading/error UI.
- [x] 3.4 Apply Sunlit Atelier feedback treatments to streaming drafts, hydration placeholders, reconnecting notices, preview waiting states, and failure recovery surfaces.
- [x] 3.5 Validate desktop/mobile hierarchy and reduced-motion behavior for active streaming and long-running preview states.

## 4. Verification

- [x] 4.1 Add or update backend unit and e2e tests for runtime event replay, asynchronous submit behavior, and conversation-loop streaming semantics.
- [x] 4.2 Add or update frontend reducer and integration tests for assistant draft rendering, reconciliation, submit/loading-state transitions, and streamed-state UI treatments.
- [x] 4.3 Run OpenSpec validation plus relevant backend/web test suites to confirm the change is implementation-ready.
