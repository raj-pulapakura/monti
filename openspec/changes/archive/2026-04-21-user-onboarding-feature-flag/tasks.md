## 1. Feature flag helper

- [x] 1.1 Add `web/lib/` module (e.g. `user-onboarding-flag.ts`) exporting `isUserOnboardingEnabled()` that reads `NEXT_PUBLIC_USER_ONBOARDING_ENABLED` and returns false only for `false` / `0` / `off` (trimmed, case-insensitive); true when unset or any other value
- [x] 1.2 Add unit tests for the parser (table-driven), colocated or under `web/` test pattern used by the repo

## 2. Authenticated home gate

- [x] 2.1 In `web/app/root-page-client.tsx` `AuthenticatedHomeGate`, after profile `ready`, set `needsOnboarding` to `isUserOnboardingEnabled() && (!profile || profile.onboardingCompletedAt === null)`; leave loading and error branches unchanged

## 3. Account settings

- [x] 3.1 In `web/app/settings/account/page.tsx`, when `isUserOnboardingEnabled()` is false: hide the no-profile “prompted on home” banner/link block and the `profileIncomplete` “unlock workspace” banner; show neutral learning-profile empty state or edit affordance per delta spec
- [x] 3.2 When the flag is true, preserve existing banners and behavior

## 4. Documentation

- [x] 4.1 Document `NEXT_PUBLIC_USER_ONBOARDING_ENABLED` in `web/README.md` next to other public env vars, including build-time inlining note and disabled token list

## 5. Verification

- [x] 5.1 Manually verify: flag unset → blocking onboarding unchanged; flag `false` → home workspace without modal for user with no profile; profile error path still shows retry; account copy matches spec for both modes
