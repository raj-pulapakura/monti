## Context

Onboarding is enforced in the web app via `AuthenticatedHomeGate` (`root-page-client.tsx`): after a successful profile fetch, users without a profile or with null `onboardingCompletedAt` see `OnboardingScreen` instead of `HomeWorkspace`. Account settings shows complementary banners. Backend conversation personalization (`buildUserProfileSystemAddendum`) already depends on `onboarding_completed_at` and is unchanged in this scope. Next.js exposes client configuration through `NEXT_PUBLIC_*` env vars inlined at build time.

## Goals / Non-Goals

**Goals:**

- One parsed boolean shared by home gate and account settings.
- When disabled: no blocking onboarding on `/` after successful profile load; account page does not use onboarding-pressure copy for the same states.
- When disabled: profile GET errors still show the existing error + retry path (no silent entry to workspace).
- Default when unset: onboarding remains **on** (preserve today’s behavior).

**Non-Goals:**

- Runtime feature toggles without rebuild (would need a different mechanism).
- Adding onboarding enforcement to `/chat/:threadId` or middleware (existing deep-link bypass stays as-is unless a future change addresses it).
- Backend flag or changing when the conversation system prompt includes user context (follow-up if product wants personalization without DB “completed” semantics).
- Auto-creating profile rows or backfilling `onboarding_completed_at` in the database.

## Decisions

**1. Flag name and surface**

- Use a single `NEXT_PUBLIC_` variable (exact name in tasks, e.g. `NEXT_PUBLIC_USER_ONBOARDING_ENABLED`) so the gate runs entirely in the client without an extra round-trip.
- Parse “disabled” the same way as existing backend flags: `false`, `0`, `off` (trimmed, case-insensitive) → disabled; unset or other values → enabled.

**2. Central helper**

- Implement `isUserOnboardingEnabled()` (or equivalent) in one module under `web/lib/` and import it from `root-page-client.tsx` and `settings/account/page.tsx` to avoid drift.

**3. Gate logic**

- `needsOnboarding = isUserOnboardingEnabled() && (!profile || profile.onboardingCompletedAt === null)` after `state.status === "ready"`.
- Do not change loading or error branches.

**4. Account page when disabled**

- Hide the “no profile → go to home / prompted on home” block and the “unlock full workspace” incomplete banner when the flag is off.
- Replace with neutral optional learning-profile empty state (e.g. short line + edit path) so the section is not a blank hole; exact copy is implementation detail within the spec constraints.

**5. Tests**

- Unit-test the env parser (table-driven) mirroring `BillingConfigService`-style tests.
- Optional: lightweight test or story for the gate expression if the project already patterns that way.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Ops expects instant toggle without redeploy | Document that `NEXT_PUBLIC_*` is build-time for Next.js client bundles. |
| Re-enabling the flag surfaces blocking flow for users who never created a profile | Document in migration/ops notes; acceptable product trade for phased rollout. |
| Web/backend mismatch if a future backend flag is added | Keep this change client-only; any server flag must be specified in a follow-up design. |

## Migration Plan

1. Ship code with default-on behavior (unset env).
2. Set env to disabled only in environments that need it; redeploy web so the bundle picks up the value.
3. Rollback: redeploy with unset or non-disabled value.

## Open Questions

- Exact env variable name (tasks can fix one canonical name across README/deploy docs if desired).
- Final neutral copy on Account when there is no profile and onboarding is off (product polish).
