## 1. Database Migration

- [x] 1.1 Add `awaiting_confirmation` to `assistant_runs.status` check constraint
- [x] 1.2 Add `confirmation_tool_call_id text` column to `assistant_runs`
- [x] 1.3 Add `confirmation_metadata jsonb` column to `assistant_runs` — stores `{ operation, estimatedCredits: { fast, quality } }`
- [x] 1.4 Update `ASSISTANT_RUN_STATUSES` in `runtime.enums.ts` to include `awaiting_confirmation`
- [x] 1.5 Add `confirmation_required` to `RUNTIME_EVENT_TYPES` in `runtime.enums.ts`

## 2. ChatTool Interface + Registry Refactor

- [x] 2.1 Define `ChatTool<TResult>` interface in `chat-tool.interface.ts` — `name`, `definition`, `requiresConfirmation(args)`, `getConfirmationMetadata(args)`, `execute(input)`
- [x] 2.2 Define `ToolConfirmationMetadata` type — `{ operation: string, estimatedCredits: { fast: number, quality: number } }`
- [x] 2.3 Create `GenerateExperienceTool` class implementing `ChatTool` — wraps `GenerateExperienceToolService`, `requiresConfirmation` always returns `true`, `getConfirmationMetadata` derives operation from args and looks up credit costs from billing config
- [x] 2.4 Refactor `ChatToolRegistryService` to hold `ChatTool[]` (injected), replace hard-coded `generate_experience` name checks in `hasTool`, `executeToolCall`, and `getToolDefinitions` with registry lookups
- [x] 2.5 Register `GenerateExperienceTool` in `ChatRuntimeModule` DI

## 3. Repository — Pause/Resume Methods

- [x] 3.1 Add `markRunAwaitingConfirmation` to `ChatRuntimeRepository` — sets `status = awaiting_confirmation`, writes `confirmation_tool_call_id` and `confirmation_metadata`
- [x] 3.2 Add `markRunRunningFromConfirmation` to `ChatRuntimeRepository` — transitions `awaiting_confirmation → running`, clears confirmation columns
- [x] 3.3 Update `hydrateThread` active run query to include `awaiting_confirmation` in the `status IN (...)` filter
- [x] 3.4 Expose `confirmation_tool_call_id` and `confirmation_metadata` in the `AssistantRunEnvelope` type and DTO mapping

## 4. Conversation Loop — Pause Logic

- [x] 4.1 Extract tool-call iteration into a shared private `executeToolCallSet(pendingToolCalls, ...)` helper in `ConversationLoopService` — shared by both `executeTurn` and `resumeTurn`
- [x] 4.2 Inside `executeToolCallSet`, after writing the tool-call message, call `tool.requiresConfirmation(args)` before executing — if true, call `markRunAwaitingConfirmation`, emit `confirmation_required` SSE, and return a `paused` signal
- [x] 4.3 Update `executeTurn` to use `executeToolCallSet` for its tool iteration loop
- [x] 4.4 Emit `confirmation_required` SSE event with full `ToolConfirmationMetadata` payload

## 5. Conversation Loop — Resume Logic

- [x] 5.1 Add `resumeTurn` method to `ConversationLoopService` — accepts `runId`, `confirmedToolCallId`, `decision: 'confirmed' | 'cancelled'`, `qualityMode?`
- [x] 5.2 In `resumeTurn`: validate run is `awaiting_confirmation`, call `markRunRunningFromConfirmation`, load canonical messages from DB
- [x] 5.3 In `resumeTurn`: derive pending tool calls — find the last assistant message with `toolCalls` in history, subtract those with existing `role: 'tool'` result messages
- [x] 5.4 If `decision === 'cancelled'`: write tool result `{ status: 'cancelled', operation }` via `createToolResultMessage`, push to canonical messages, skip to LLM round
- [x] 5.5 If `decision === 'confirmed'`: call `executeToolCallSet` on the remaining pending tool calls, passing the user-selected `qualityMode` for the confirmed tool call

## 6. API Endpoint

- [x] 6.1 Add `parseConfirmRunRequest` DTO parser — validates `{ decision: 'confirmed' | 'cancelled', qualityMode?: 'fast' | 'quality' }` and threadId/runId path params
- [x] 6.2 Add `confirmRun` method to `ChatRuntimeService` — validates run ownership and `awaiting_confirmation` status, fires `conversationLoop.resumeTurn(...)` async, returns immediately
- [x] 6.3 Add `POST :threadId/runs/:runId/confirm` endpoint to `ChatRuntimeController` — auth-gated, calls `chatRuntimeService.confirmRun`

## 7. Credit Gate — Submit-Time Check Update

- [x] 7.1 Update the pre-submit credit check in `ChatRuntimeService.submitMessage` (or `ChatRuntimeCreditService`) to use fast-tier cost as the minimum threshold instead of the selected-mode cost
- [x] 7.2 Remove any reference to `auto` generation mode from the pre-submit credit check path
- [x] 7.3 Update `extractRequestedQualityMode` in `conversation-loop.service.ts` to ignore `auto` values (treat as undefined)

## 8. Frontend — Confirmation Gate Component

- [x] 8.1 Create `ConfirmationGate` component — receives operation label, estimated credits for both modes, Confirm/Cancel callbacks; renders mode picker (Draft / High Quality) with credit cost labels when billing enabled
- [x] 8.2 Disable composer input and submit button when gate is visible (hard UI invariant)
- [x] 8.3 Add `confirmation_required` event handler to the thread SSE event consumer — sets gate state from event payload
- [x] 8.4 On `hydrateThread` response: if `activeRun.status === 'awaiting_confirmation'`, set gate state from `activeRun.confirmationMetadata` (handles reconnect and server-restart cases)
- [x] 8.5 On Confirm: POST `/threads/:threadId/runs/:runId/confirm` with selected mode, dismiss gate, enter "generating" state
- [x] 8.6 On Cancel: POST `/threads/:threadId/runs/:runId/confirm` with `decision: 'cancelled'`, dismiss gate
- [x] 8.7 Handle confirm endpoint error (run no longer in `awaiting_confirmation`) — dismiss gate gracefully, show brief toast

## 9. Frontend — Composer Cleanup

- [x] 9.1 Remove generation mode dropdown from the chat composer
- [x] 9.2 Remove mode dropdown from the home create workspace
- [x] 9.3 Remove `generationMode` field from message submit payload (no longer sent)
- [x] 9.4 Remove `auto` mode handling from `generation-mode.ts` and related UI state
- [x] 9.5 Update soft-gate logic in `chat-credit-awareness` to check minimum (fast) tier cost only, not selected-mode cost

## 10. Tests

- [x] 10.1 Unit test `GenerateExperienceTool.requiresConfirmation` — always returns true for any args
- [x] 10.2 Unit test `ConversationLoopService.executeTurn` — asserts that when a tool returns `requiresConfirmation: true`, `markRunAwaitingConfirmation` is called and no tool execution occurs
- [x] 10.3 Unit test `ConversationLoopService.resumeTurn` (confirmed path) — asserts tool executes with user-selected mode, tool result written, loop continues to next LLM round
- [x] 10.4 Unit test `ConversationLoopService.resumeTurn` (cancelled path) — asserts cancelled tool result written, LLM round triggered
- [x] 10.5 Unit test sequential confirmation — mock two confirmable tool calls, assert loop pauses twice with correct `confirmation_tool_call_id` each time
- [x] 10.6 Update existing `ChatToolRegistryService` tests for refactored `ChatTool[]` interface
