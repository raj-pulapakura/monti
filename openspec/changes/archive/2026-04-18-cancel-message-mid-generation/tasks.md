## 1. Backend — Abort Registry Service

- [x] 1.1 Create `RunAbortRegistryService` with `register(runId): AbortSignal`, `abort(runId): boolean`, and `release(runId): void` methods backed by `Map<string, AbortController>`
- [x] 1.2 Add `RunAbortRegistryService` to `ChatRuntimeModule` providers
- [x] 1.3 Inject `RunAbortRegistryService` into `ConversationLoopService`

## 2. Backend — Abort-Aware Conversation Loop

- [x] 2.1 In `ConversationLoopService.executeTurn()`: register an `AbortController` for the run at the start and call `release()` in all terminal paths (success, failure, cancel)
- [x] 2.2 Pass the abort `signal` into `toolLlmRouter.runTurn()` on every call in `runConversationRounds()`
- [x] 2.3 Add abort signal check before each LLM round starts; throw a recognisable `AbortError` if signalled
- [x] 2.4 Add abort signal check before each tool call executes in `executeToolCallSet()`; throw if signalled
- [x] 2.5 Catch `AbortError` (distinct from other errors) in `executeTurn()` and route to new `handleCancelledRun()` rather than `markRunFailed()`

## 3. Backend — Cancel Path Persistence

- [x] 3.1 Add `markRunCancelled()` to `ChatRuntimeRepository` (mirrors `markRunFailed` but sets status `cancelled`)
- [x] 3.2 Implement `handleCancelledRun()` in `ConversationLoopService`: persist partial `streamedAssistantText` if non-empty (emit `assistant_message_created`), restore sandbox state to prior stable snapshot, mark tool invocation failed with `USER_CANCELLED` if mid-execution, call `markRunCancelled()`, emit `run_cancelled` event
- [x] 3.3 Add sandbox state snapshot capture when `tool_started` fires for `generate_experience` (store on the `RunAbortRegistryService` entry or as a local variable threaded through)
- [x] 3.4 Add `updateSandboxState()` call in the cancel path to restore the snapshot if `sandbox_state` is `creating`

## 4. Backend — SSE Event Type & Cancel Endpoint

- [x] 4.1 Add `run_cancelled` to `RuntimeEventType` enum in `runtime.enums.ts`
- [x] 4.2 Add `parseCancelRunRequest` DTO validator in `chat-runtime.dto.ts` (threadId + runId)
- [x] 4.3 Add `cancelRun()` method to `ChatRuntimeService`: validates ownership, checks current status (idempotent return if terminal), calls `RunAbortRegistryService.abort()`, handles zombie-run path (no registry entry → direct DB cancel)
- [x] 4.4 Add `POST :threadId/runs/:runId/cancel` route to `ChatRuntimeController` wired to `chatRuntimeService.cancelRun()`

## 5. Frontend — Runtime State Reducer

- [x] 5.1 Add `run_cancelled` to `RuntimeEventData['type']` union in `runtime-state.ts`
- [x] 5.2 Add `run_cancelled` case in `reduceRuntimeEvent()`: set `activeRun.status = 'cancelled'`, clear `assistantDraft`, clear `activeToolInvocation`
- [x] 5.3 Update `getRetryComposerValue()` to also trigger on `run?.status === 'cancelled'` (same behaviour as `failed`)
- [x] 5.4 Confirm `isRunActive()` does NOT include `cancelled` (it should already exclude it — verify)

## 6. Frontend — Stop Button UI

- [x] 6.1 Add `onStop?: () => void` and `cancelPending?: boolean` props to `ChatComposer`
- [x] 6.2 In `ChatComposer`: when `generationInFlight` is true, render a stop (square) icon button instead of the send button; show spinner when `cancelPending` is true
- [x] 6.3 Add `cancelRunPending` state and `handleCancelRun()` async function to `ChatThreadPage`; `handleCancelRun` calls `POST .../runs/:runId/cancel`, sets optimistic cancelled state on `activeRun`, and manages `cancelRunPending` flag
- [x] 6.4 Wire `onStop` and `cancelPending` props on `<ChatComposer>` in `page.tsx`
- [x] 6.5 Add `run_cancelled` to the `eventTypes` set in the SSE `fetchEventSource` listener

## 7. Frontend — Cancelled Run UX

- [x] 7.1 Update `getThreadNotice()` (or its call site) to show a neutral "Reply stopped." notice when `activeRun?.status === 'cancelled'` (distinct from the error notice on `failed`)
- [x] 7.2 Verify `getRetryComposerValue` pre-fills the composer on cancelled runs (from task 5.3) and confirm the "Reuse last prompt" button renders

## 8. Tests

- [x] 8.1 Unit test `RunAbortRegistryService`: register, abort, release, idempotent abort
- [x] 8.2 Unit test `ConversationLoopService` cancel path: abort during LLM streaming → partial text saved, sandbox rolled back, `run_cancelled` emitted
- [x] 8.3 Unit test `reduceRuntimeEvent` with `run_cancelled` event: clears draft, clears tool invocation, sets status
- [x] 8.4 Unit test `getRetryComposerValue` returns last user prompt for cancelled runs
