## Why

New users land in the app with no context captured — we don't know if they're educators, tutors, students, or parents. This data is valuable for segmentation, LTV modeling, and personalizing the AI system prompt to the user's actual role.

## What Changes

- New blocking onboarding modal shown immediately post-signup and on first sign-in if not yet completed
- Two-question flow: (1) role selection with free-text fallback for "something else", (2) context/setting selection
- User profile stored in DB and surfaced in account settings for later editing
- User role + context injected into the AI conversation system prompt to personalize responses

## Capabilities

### New Capabilities

- `user-onboarding-flow`: Blocking 2-step modal collecting role and context from new users; shown post-signup and on first sign-in until completed; "something else" triggers a free-text follow-up
- `user-profile`: DB storage and retrieval of user profile data (role, context, free-text); injected into AI system prompt per conversation

### Modified Capabilities

- `account-settings`: Add editable profile section allowing users to update their role and context after onboarding

## Impact

- New `user_profiles` Supabase table (user_id, role, context, role_other_text, onboarding_completed_at)
- Backend: new profile CRUD endpoints; system prompt construction updated to inject profile data
- Frontend: new onboarding modal component; root page guard to check onboarding completion; account settings section
- Supabase migration required
