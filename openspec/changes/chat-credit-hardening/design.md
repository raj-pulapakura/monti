## Context

The chat runtime currently enforces credits only inside the `generate_experience` tool execution (`GenerateExperienceTool` → `CreditReservationService.reserveForToolInvocation`). Every conversation turn — the LLM call that drives the back-and-forth before any tool is invoked — runs with no credit check and no request throttle. The UI soft-gate (disabled send button) is already specified in `chat-credit-awareness` but not yet implemented; it also provides zero API-layer protection since the endpoint is unguarded.

Two entry points need hardening:
1. `POST /api/chat/threads/:threadId/messages` — no credit pre-check, no rate limit.
2. The auto-mode resolution path — currently `generationMode` is passed through from the frontend and used as-is; there is no server-side fallback when quality credits are unaffordable.

## Goals / Non-Goals

**Goals:**
- Reject message submission at the API layer when the user's balance is insufficient for the selected mode (mirrors the UI soft-gate).
- Silently downgrade `auto` mode to `fast` when quality credits are unaffordable, server-side, with no error surfaced to the user.
- Throttle message submission per authenticated user to bound request volume regardless of credit state.
- Implement the UI soft-gate (disable send button, inline warning, upgrade/top-up CTA) specified in `chat-credit-awareness`.

**Non-Goals:**
- Gating the conversation LLM call itself with a credit reservation (reserve-and-settle remains scoped to `generate_experience` tool invocations only).
- Per-IP rate limiting or DDoS-level protection (handled at infrastructure layer).
- Prompt hardening or context window management (separate future proposal).
- Any database schema changes.

## Decisions

### Decision 1: Credit pre-check at `submitMessage`, not inside the conversation loop

**Choice:** Check credit availability in `ChatRuntimeService.submitMessage` before the run is queued, using a lightweight read of the user's spendable balance.

**Why:** The conversation loop is fire-and-forget (`void this.executeQueuedRun(…)`). By the time the loop runs, the HTTP response has already returned. A check inside the loop cannot reject the request. The pre-check at submit time is the only point in the request lifecycle where we can return a 4xx to the caller.

**Alternative considered:** Check inside `ConversationLoopService` and emit a failure event. Rejected — this still burns tokens on the LLM call that immediately precedes any tool invocation, and the error is asynchronous, requiring frontend to handle it through the SSE event stream rather than a synchronous HTTP error.

**What the pre-check does NOT do:** It does not create a reservation. It reads spendable balance (included + top-up, applying bucket rules) and compares against the mode cost. The actual reservation still happens inside `generate_experience` as before. This means there is a TOCTOU window (balance could change between pre-check and reservation), but this is acceptable — the reservation step will still reject if balance is gone by then.

### Decision 2: Auto-mode downgrade lives in `submitMessage` before the run is queued

**Choice:** When `generationMode = auto`, read the user's quality-credit balance. If insufficient, rewrite the effective mode to `fast` before persisting the `generationMode` on the message record.

**Why:** The `generationMode` on the message record is what the conversation loop reads to resolve the quality tier. Rewriting it at submit time means the loop and tool execution pick up the correct tier with no additional logic changes downstream. It's the lowest-risk insertion point.

**Alternative considered:** Resolve the downgrade inside `generate_experience` tool execution. Rejected — by then a reservation attempt at quality tier would already fail with `INSUFFICIENT_CREDITS`, which surfaces an error to the user. The downgrade must happen before any failure path is hit.

**UX implication:** The user selected `auto`; the backend routes to `fast` silently. No error is shown. The run proceeds and produces a result. This matches the intended behavior.

### Decision 3: Rate limiting via NestJS `@nestjs/throttler` at the route level

**Choice:** Add `@nestjs/throttler` (not currently installed) as a backend dependency. Apply a `@Throttle` decorator to `POST /api/chat/threads/:threadId/messages` only. Use the authenticated user ID as the throttle key (not IP).

**Why user-ID keying:** Shared IPs (office networks, VPNs, mobile NAT) would cause false positives with IP-based throttling. Authenticated routes have a reliable, per-user identity.

**Why route-scoped only:** Applying throttling globally is overkill for an initial implementation and could interfere with other endpoints (SSE streams, hydration) that have different usage patterns.

**Starting limit:** 30 requests per minute per user. This is generous enough to not impact normal usage (a fast typist sends maybe 5–10 messages/min) while capping automated abuse. Should be configurable via environment variable so it can be tuned without a deploy.

**Alternative considered:** Application-level in-memory counter. Rejected — doesn't survive server restarts, doesn't work in multi-instance deployments.

### Decision 4: New `INSUFFICIENT_CREDITS` HTTP error response at submit time

**Choice:** Return HTTP 402 with error code `INSUFFICIENT_CREDITS` when the pre-check fails. The frontend should treat this identically to how it handles the existing `InsufficientCreditsError` (if it surfaces at all, given the UI soft-gate should prevent the request from being sent in the first place).

**Why 402:** Semantically correct ("Payment Required"). Already used by the existing `InsufficientCreditsError` class in the codebase.

## Risks / Trade-offs

- **TOCTOU window on credit pre-check** → Acceptable. The reserve-and-settle inside `generate_experience` is the atomic hard gate. The pre-check is a fast-reject that eliminates wasted conversation-model LLM calls; it doesn't need to be perfectly atomic.

- **Auto-mode downgrade is invisible to the user** → By design. If this causes confusion (user expects quality, gets fast), the credit cost label in the UI already signals what mode was used. No additional mitigation needed at v1.

- **Rate limit misconfiguration could block legitimate users** → Mitigate by making the limit configurable via env var (`CHAT_RATE_LIMIT_PER_MINUTE`, default 30) and ensuring the throttler returns a clear 429 with a `Retry-After` header.

- **Credit pre-check adds latency to `submitMessage`** → The check reads from `billing_repository` (already called in the billing flow). At the expected scale this is a single indexed DB read; negligible latency impact.

## Migration Plan

1. Install `@nestjs/throttler` in the backend package.
2. Register `ThrottlerModule` in `AppModule`.
3. Implement UI soft-gate on the frontend (no backend dependency).
4. Add credit pre-check to `ChatRuntimeService.submitMessage`; deploy behind `CREDIT_ENFORCEMENT_ENABLED` flag (already exists) so it can be enabled independently of the UI.
5. Add auto-mode downgrade logic at the same insertion point.
6. Add `@Throttle` decorator to the message submission route.
7. Enable `CREDIT_ENFORCEMENT_ENABLED` in production.

**Rollback:** The credit pre-check and auto-mode downgrade are gated by `CREDIT_ENFORCEMENT_ENABLED`. Disabling it reverts enforcement behavior without a code rollback. Rate limiting can be disabled by setting `CHAT_RATE_LIMIT_PER_MINUTE` to a very high value or removing the decorator in a hotfix deploy.

## Open Questions

- Should the rate limit apply when `CREDIT_ENFORCEMENT_ENABLED` is false (i.e. is rate limiting always-on, or coupled to the enforcement flag)? Recommendation: always-on — rate limiting is infrastructure hygiene, not billing logic.
- Should `auto`-mode downgrade be logged/telemetered so we can track how often it fires? Recommendation: yes, a single structured log event is sufficient for v1.
