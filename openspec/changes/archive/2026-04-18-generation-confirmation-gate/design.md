## Context

The conversation loop (`ConversationLoopService.executeTurn`) currently executes tool calls immediately after the LLM requests them. The `complete-tool-call-message-persistence` groundwork means the assistant tool-call message is now written to `chat_messages` **before** the tool executes. This is the durable anchor for the confirmation gate: when we pause, the tool call is already in history, and on resume `buildConversationMessages` reconstructs the full state from the DB without any additional bookkeeping.

The loop currently hard-codes `generate_experience` by name in multiple places (`hasTool`, `executeToolCall`, the `generate_experience`-specific sandbox update paths). This change refactors to a `ChatTool` interface where each tool owns its behavior.

## Goals / Non-Goals

**Goals:**
- Every `generate_experience` call (generate + refine) pauses for user confirmation before executing
- Users pick Draft or High Quality at the gate and see credit costs for each
- Gate state survives server restarts and page reconnects via hydration
- Sequential per-tool-call confirmation: if multiple tool calls in one LLM response, each confirmable tool gates individually in order
- `ChatTool` interface makes confirmation a tool concern, not a loop concern

**Non-Goals:**
- No timeout on `awaiting_confirmation` — runs stay paused indefinitely until the user acts
- No handling of "user sends new message while gate is open" — the UI hard-blocks input when the gate is shown; this is a UI invariant, not a backend concern
- No changes to `tool_invocations`, billing schema, or SSE infrastructure
- Not renaming fast→Draft / quality→High Quality at the type level (display labels only in UI)

## Decisions

### Decision: `ChatTool` interface owned by the registry, not the loop

Define a `ChatTool` interface:
```ts
interface ChatTool<TResult> {
  readonly name: string;
  readonly definition: CanonicalToolDefinition;
  requiresConfirmation(args: Record<string, unknown>): boolean;
  getConfirmationMetadata(args: Record<string, unknown>): ToolConfirmationMetadata;
  execute(input: ToolExecuteInput): Promise<TResult>;
}
```

`ChatToolRegistryService` holds `ChatTool[]`. The loop calls `tool.requiresConfirmation(args)` without knowing which tool it's dealing with. The existing `if (input.name !== 'generate_experience')` dispatch in `executeToolCall` becomes a registry lookup.

Alternative considered: add a `requiresConfirmation(toolName, args)` method to the registry with a switch/case. Rejected — that's just moving the hardcoding one level up.

### Decision: Pause state stored on `assistant_runs`, not a separate table

Add two columns to `assistant_runs`:
- `confirmation_tool_call_id text` — the ID of the tool call we're paused on (used by the resume path to find the right tool call)
- `confirmation_metadata jsonb` — operation label + estimated credits for both modes — pre-computed at pause time so the UI can render the gate purely from hydration without reading `chat_messages`

Alternative considered: derive gate display data from `chat_messages` on hydration (find last assistant message with `toolCalls`, parse the pending one). Rejected — more expensive and fragile; storing metadata on the run row makes hydration a single query.

### Decision: Resume via dedicated `resumeTurn` method, sharing a `executeToolCallSet` helper

`executeTurn` handles new (queued) runs. `resumeTurn` handles `awaiting_confirmation` resumes. Both delegate to a shared private `executeToolCallSet(pendingToolCalls, canonicalMessages, ...)` helper that:
1. Iterates tool calls
2. Checks `requiresConfirmation` on each
3. If confirmation required → marks run `awaiting_confirmation`, emits SSE, returns
4. Otherwise → executes, writes result, continues

This makes the pause/resume logic a single implementation used by both entry points.

Alternative considered: detect `awaiting_confirmation` inside `executeTurn` on entry and branch. Rejected — conflates two distinct entry conditions and makes the method harder to reason about.

### Decision: On resume, find pending tool calls from `chat_messages` history + `confirmation_tool_call_id`

`resumeTurn` loads canonical messages from DB. The last assistant message with `toolCalls` is the paused one. Tool calls already executed have corresponding `role: 'tool'` messages in history. The remaining set = `toolCalls` with no matching result. `confirmation_tool_call_id` is used to validate that the confirmed tool call matches what we paused on (guard against stale confirm requests).

### Decision: Credit check at submit uses minimum-tier (fast) cost, not the selected mode

Mode is no longer known at submit time. Replace the per-mode pre-submit check with: reject if spendable balance < fast cost. The gate itself shows real costs for both modes. If the user can't even afford fast, the submit is blocked before the run is queued.

Alternative considered: no credit check at submit at all — let the gate show costs and let execution-time reservation fail. Rejected — this queues a run, runs the LLM, and only then tells the user they can't afford it, which wastes credits on the conversation turn.

### Decision: Gate UI driven by both SSE event and hydration, not SSE alone

The SSE event service is in-memory. On reconnect or server restart, `confirmation_required` is gone. The UI MUST render the gate on `hydrateThread` response when `activeRun.status === 'awaiting_confirmation'`, using `activeRun.confirmation_metadata`. The SSE event is additive — it triggers the gate without requiring a hydration round-trip on the happy path.

### Decision: Sequential confirmation — one gate per tool call, in order

When the LLM returns multiple tool calls and the first requires confirmation, we pause on it. On resume, we execute it and continue iterating. If the next tool call also requires confirmation, we pause again with a new `confirmation_tool_call_id` update on the run. This repeats until all tool calls are executed, then the loop proceeds to the next LLM round.

Alternative considered: Confirm-all-at-once gate listing every confirmable tool call. Rejected — adds UI complexity and is premature given current single-tool reality.

## Risks / Trade-offs

**Orphaned tool-call message if server crashes during pause** → Tool-call message is in `chat_messages` but no tool result ever written. On the next LLM turn (if the run somehow resumes), provider adapters may fail on the unpaired exchange. Mitigation: the confirm endpoint validates `run.status === awaiting_confirmation` and returns an error if not; stale runs stay paused and are handled manually or via future cleanup job. This is the same "incomplete history" edge case acknowledged in the tool-call persistence design.

**Increased latency on every generation** → One extra HTTP round-trip (confirm endpoint) + one extra LLM round (to generate the post-tool response) already existed. The gate itself adds user think-time but no system latency. Acceptable for the use case.

**`confirmation_required` SSE event lost on reconnect** → Fully mitigated by hydration-driven gate rendering.

**Edge case: confirm endpoint called on a cancelled/failed run** → Validate `run.status === awaiting_confirmation` in `confirmRun`. Return a clear error. UI dismisses the gate and shows a toast.

## Migration Plan

1. DB migration: add `awaiting_confirmation` to `assistant_runs.status` check constraint, add `confirmation_tool_call_id` and `confirmation_metadata` columns
2. Backend: `ChatTool` interface + registry refactor + loop pause/resume
3. Frontend: gate component + hydration check + SSE handler + composer changes (remove mode dropdown)
4. Deploy atomically — no interim state where the loop can pause but the UI can't handle it

No rollback complexity: reverting the code stops pausing runs. Existing `awaiting_confirmation` rows (if any) would be stranded, but pre-deploy there are none.

## Open Questions

None — design is fully resolved based on prior exploration and edge case analysis.
