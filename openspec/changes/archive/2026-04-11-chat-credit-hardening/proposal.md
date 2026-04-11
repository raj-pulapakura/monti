## Why

Monti's credit enforcement only fires when the `generate_experience` tool runs — the conversation layer itself is completely ungated, meaning a user with zero credits can still trigger unlimited LLM calls by chatting, and a motivated actor can bypass the UI entirely by calling the API directly. This change closes those gaps before a cost-abuse incident forces a reactive fix.

## What Changes

- **API-layer credit gate on message submission**: Before queuing a conversation run, the backend checks whether the user has sufficient credits for the chosen generation mode and rejects the request if not. This ensures the UI soft-gate and the API enforce the same contract.
- **Auto-mode credit downgrade**: When `generationMode` is `auto` and the user cannot afford quality-tier credits, the backend silently routes the run to fast mode rather than rejecting it. This is handled server-side; the frontend is not involved.
- **Per-user rate limiting on message submission**: The `POST /api/chat/threads/:threadId/messages` endpoint is throttled per authenticated user to prevent spam-volume abuse independent of credit balance.
- The UI soft-gate (disabled send button when balance is insufficient) is already specified in `chat-credit-awareness` and is implemented as part of this change.

## Capabilities

### New Capabilities
- `conversation-credit-gate`: API-level credit check on message submission — rejects the request before a run is queued if the user's balance is insufficient for the selected mode; handles auto-mode downgrade to fast when quality is unaffordable.
- `message-rate-limiting`: Per-authenticated-user throttle on the message submission endpoint to bound request volume regardless of credit balance.

### Modified Capabilities
- `chat-credit-awareness`: Extend to cover the auto-mode downgrade UX — when the backend silently routes auto to fast due to insufficient quality credits, no user-visible error should appear; the existing credit cost label and soft-gate behavior remain unchanged.

## Impact

- **Backend**: `chat-runtime.controller.ts`, `chat-runtime.service.ts` — credit pre-check at submit time; NestJS throttler added to message submission route.
- **Backend**: `billing/credit-reservation.service.ts`, `billing/entitlement.service.ts` — credit availability read used for pre-check (read-only, no new reservation logic at this layer).
- **Backend**: `llm/llm-config.service.ts` or `chat-runtime` layer — auto-mode downgrade logic resolving quality→fast when balance is insufficient.
- **Frontend**: `web/app/chat/[threadId]/` — implements the soft-gate UI (disable send, inline warning, CTA) already specified in `chat-credit-awareness`.
- **Dependencies**: NestJS `@nestjs/throttler` added if not already present.
- No database schema changes required.
- No breaking API changes; the credit-rejection response is a new 4xx error code surfaced to the frontend.
