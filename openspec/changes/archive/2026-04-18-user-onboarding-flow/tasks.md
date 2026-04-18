## 1. Database

- [x] 1.1 Write Supabase migration to create `user_profiles` table (user_id uuid PK, role text, context text, role_other_text text nullable, onboarding_completed_at timestamptz)
- [x] 1.2 Add RLS policies: users can read and write only their own profile row
- [x] 1.3 Add FK constraint from `user_profiles.user_id` to `auth.users(id)` ON DELETE CASCADE
- [x] 1.4 Update `supabase.types.ts` to include the new table type

## 2. Backend — Profile API

- [x] 2.1 Create `UserProfileModule` with `UserProfileService` and `UserProfileController`
- [x] 2.2 Implement `GET /profile` endpoint — returns the authenticated user's profile (or 404 if none)
- [x] 2.3 Implement `PATCH /profile` endpoint — upserts role, context, role_other_text, sets onboarding_completed_at on first save
- [x] 2.4 Add input validation DTOs for role and context enums
- [x] 2.5 Register `UserProfileModule` in `AppModule`

## 3. Backend — System Prompt Injection

- [x] 3.1 Inject `UserProfileService` into `ConversationLoopService`
- [x] 3.2 Fetch user profile at conversation start in `ConversationLoopService`
- [x] 3.3 Prepend user context block to system prompt when profile is complete (role + context; do NOT include raw role_other_text)
- [x] 3.4 Verify no profile → no change to system prompt

## 4. Frontend — Onboarding Modal

- [x] 4.1 Create `OnboardingModal` component with two-step layout (role → context)
- [x] 4.2 Implement step 1: role selection grid (Educator, Tutor, Student, Parent, Learning on my own, Something else)
- [x] 4.3 Implement free-text input that appears when "Something else" is selected on step 1
- [x] 4.4 Implement step 2: context selection grid (K-12 school, Higher education, Corporate / professional training, Personal use)
- [x] 4.5 Implement back navigation from step 2 to step 1 with preserved selection
- [x] 4.6 Wire save: call `PATCH /profile` on step 2 selection; dismiss modal on success
- [x] 4.7 Implement error state with "Try again" button on API failure
- [x] 4.8 Style modal to match Sunlit Atelier design language (blocking overlay, no close affordance)

## 5. Frontend — Onboarding Guard

- [x] 5.1 Create `useUserProfile` hook that fetches the user's profile via `GET /profile`
- [x] 5.2 Update `RootPageClient` to show `OnboardingModal` when user is authenticated AND `onboarding_completed_at` is null
- [x] 5.3 Ensure `HomeWorkspace` does not render until onboarding is complete or profile is loaded

## 6. Frontend — Account Settings

- [x] 6.1 Add profile section to `/settings/account` page displaying current role and context
- [x] 6.2 Implement inline edit for role and context (reuse selector components from onboarding modal)
- [x] 6.3 Wire save to `PATCH /profile` endpoint
- [x] 6.4 Show "Complete your profile" prompt for users with null `onboarding_completed_at`
