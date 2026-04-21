## Why

Operators need to ship or test the product without the blocking learning-profile onboarding step (e.g. internal demos, phased rollout, or incident response). Today, incomplete or missing `user_profiles` forces the onboarding UI on `/` and nudges users on Account settings; there is no configuration switch to turn that off without code changes.

## What Changes

- Introduce an environment-controlled feature flag (default: onboarding **enabled** so current behavior is preserved when unset).
- When the flag is **disabled**:
  - Authenticated users go straight to the home workspace from `/` even if they have no profile or null `onboardingCompletedAt`.
  - Account settings must not show onboarding-pressure copy that assumes a blocking home gate (no profile / incomplete-onboarding banners tied to that flow).
- Profile fetch **error** paths remain unchanged: users still see retry UI instead of being dropped into the workspace on failure.
- **No breaking API or database contract** in the initial scope: `PATCH /api/profile` and `buildUserProfileSystemAddendum` behavior stay as today unless a follow-up explicitly extends server behavior.

## Capabilities

### New Capabilities

_(none — behavior is a configurable mode of existing flows.)_

### Modified Capabilities

- `user-onboarding-flow`: Add requirements for when onboarding is disabled by configuration (no blocking gate on home; default remains current blocking behavior).
- `account-settings`: Add requirements for account learning-profile messaging when onboarding is disabled (no misleading “you will be prompted on home” / “unlock workspace” copy for the same conditions).

## Impact

- **Web**: `web/app/root-page-client.tsx` (`AuthenticatedHomeGate`), `web/app/settings/account/page.tsx`, and a small shared env helper (e.g. under `web/lib/`) for parsing the flag consistently.
- **Backend**: None required for the baseline change (conversation system prompt still omits user context until onboarding is completed in DB per `user-profile` spec).
- **Ops**: Document `NEXT_PUBLIC_*` (or chosen name) in deploy/config; note build-time inlining for Next.js client bundles.
- **Known routing note**: `/chat/:threadId` already bypasses the home onboarding gate when signed in; the flag aligns intentional product behavior with that deep-link pattern rather than introducing a new server route.
