# Sunlit Atelier Rollout Checklist

## Deploy Steps

1. Deploy shared foundation changes first (`web/app/layout.tsx`, `web/app/globals.css`).
2. Deploy route-level copy/state updates (`web/app/page.tsx`, `web/app/chat/[threadId]/page.tsx`, auth pages).
3. Run post-deploy smoke checks:
   - Root route loads for anonymous and authenticated sessions.
   - Home create flow still creates a thread and routes to `/chat/<threadId>`.
   - Chat stream status, prompt submission, retry affordance, and preview rendering still function.
   - Auth sign-in/sign-up/forgot/reset still complete without flow regressions.

## Rollback Order

1. Revert auth-route UI updates.
2. Revert chat-thread UI/status updates.
3. Revert home/landing UI updates.
4. Revert shared style and font foundation updates.

## Regression Watchpoints

- Button contrast and readability on brand surfaces.
- Empty/loading/error state visibility across low-bandwidth scenarios.
- Runtime status wording still matching underlying run/sandbox states.
- Mobile layout integrity for chat/sandbox stack and home carousel.
