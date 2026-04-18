## Why

Users have no opportunity to review credit costs or choose generation quality before Monti starts spending their credits — the tool fires immediately after the LLM decides to call it. This creates surprise charges and removes user agency over cost/quality trade-offs that matter to educators managing tight credit budgets.

## What Changes

- **New**: `awaiting_confirmation` status on `assistant_runs` — the conversation loop can pause mid-tool-set and durably persist that state
- **New**: `POST /threads/:threadId/runs/:runId/confirm` endpoint — resumes or cancels a paused run
- **New**: `confirmation_required` SSE event — carries operation type and credit estimates for both modes to the UI
- **New**: `ChatTool` interface — tools declare whether they require confirmation; the registry dispatches based on this, removing hardcoded `generate_experience` name checks
- **New**: Confirmation gate UI — shown when `confirmation_required` is received or when hydration returns a run in `awaiting_confirmation`; displays operation label, Draft/High Quality mode picker with credit costs, and Confirm/Cancel actions
- **Changed**: Mode selection moves from the message composer to the confirmation gate — users pick Draft or High Quality at the moment they see the cost, not before
- **Changed**: `generate_experience` always requires confirmation (both `generate` and `refine` operations) — business decision
- **Changed**: `auto` generation mode removed entirely — mode is always an explicit user choice at the gate
- **Removed**: Mode dropdown from the message composer
- **Removed**: Pre-submit mode-based credit check (mode is unknown at submit time); minimum-tier credit check replaces it

## Capabilities

### New Capabilities

- `tool-confirmation-gate`: Pause/resume semantics for tool calls requiring user confirmation — new run status, SSE event, confirm endpoint, hydration-safe gate state, sequential per-tool-call confirmation flow, tool-owned confirmation flag via `ChatTool` interface

### Modified Capabilities

- `conversation-tool-loop`: Loop must support pausing at any tool call that returns `requiresConfirmation: true`, resuming on user decision, and continuing iteration of remaining tool calls in the same set — with each subsequent confirmable tool call also gating individually
- `conversation-credit-gate`: Mode is no longer known at submit time; pre-submit mode-based credit check replaced by a minimum-tier (fast) balance check; auto mode removed
- `chat-credit-awareness`: Mode dropdown removed from composer; credit cost display moves to confirmation gate UI; soft-gate at submit changes to minimum-tier balance check only

## Impact

- `assistant_runs` table: new `awaiting_confirmation` status (DB migration), new `confirmation_tool_call_id` column and `confirmation_metadata` JSON column on the run row
- `runtime.enums.ts`: `ASSISTANT_RUN_STATUSES`, `RUNTIME_EVENT_TYPES`
- `chat-tool-registry.service.ts`: full refactor to `ChatTool[]` interface; removes hardcoded tool name dispatch
- `conversation-loop.service.ts`: pause logic, `resumeTurn` entry point, shared tool execution helper
- `chat-runtime.controller.ts`: new confirm endpoint
- `chat-runtime.service.ts`: new `confirmRun` method
- `chat-runtime.repository.ts`: `markRunAwaitingConfirmation`, updated `hydrateThread` status filter
- Web: composer loses mode dropdown; new confirmation gate component; hydration check on thread load; event handler for `confirmation_required`
