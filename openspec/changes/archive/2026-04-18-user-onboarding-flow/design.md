## Context

No user profile data is currently captured. The AI system prompt in `llm-config.service.ts` is static with no per-user personalization. After signup, users land directly in `HomeWorkspace` with no onboarding step. The `user_id` is the only user-identifying data stored beyond Supabase auth claims.

## Goals / Non-Goals

**Goals:**
- Collect role and context from every new user via a blocking modal
- Show the modal on first sign-in if onboarding was not completed at signup
- Persist profile data in a dedicated `user_profiles` table
- Inject role/context into the AI conversation system prompt
- Allow users to update their profile in account settings

**Non-Goals:**
- Skipping/dismissing onboarding without completing it
- Analytics pipeline or funnel tracking for onboarding completion
- Expanding to more than two questions at this stage
- Localisation or multi-language support

## Decisions

### 1. New `user_profiles` table over JWT custom claims

JWT custom claims are managed by Supabase auth and are harder to update after issuance. A dedicated table is directly queryable, supports RLS, and is easy to extend. Profile data is read on every conversation — a table lookup is clean and auditable.

_Alternative considered_: Storing role in Supabase `raw_user_meta_data`. Rejected because it couples product data to auth infrastructure and is harder to query from the backend.

### 2. Blocking modal over dedicated `/onboarding` route

Two questions, no typing required (except "something else" free-text). A blocking modal keeps the flow in-context and requires no navigation. A dedicated route is better if the onboarding expands to multi-step flows with images or video — premature for current scope.

_Alternative considered_: `/onboarding` page with stepper. Rejected as over-engineered for two questions.

### 3. Inject profile in `conversation-loop.service.ts`, not `llm-config.service.ts`

`conversation-loop.service.ts` already assembles per-conversation context (message window, thread state). Injecting user profile here keeps the static system prompt clean and allows per-user variation without touching the base prompt config.

_Alternative considered_: Dynamic system prompt construction in `llm-config.service.ts`. Rejected because that service is not request-scoped and would require passing user context through an additional layer.

### 4. Frontend guard in `RootPageClient` checks `onboarding_completed_at`

The root page already branches on auth state (authenticated user → `HomeWorkspace`, unauthenticated → `MarketingLanding`). Adding a third branch for `onboarding_completed_at === null` is the minimal change. The modal renders over a blank/loading state, not over the workspace.

### 5. Free-text "something else" stored but injected as a sanitized excerpt

Raw free-text from users should not flow directly into system prompts. The role category ("other") is injected; the free-text is stored for product analytics but truncated and not included in prompt injection to avoid prompt injection risk.

## Risks / Trade-offs

- **Existing users have null profiles** → The "first sign-in if not completed" guard handles this naturally; they see the modal on next login.
- **Free-text could contain PII** → Stored in DB but not injected into prompts; ensure RLS restricts access to the owning user and backend service role.
- **Token cost of profile injection** → Profile context is ~20–30 tokens per conversation; negligible.
- **Modal blocks users who encounter a bug** → If the profile save fails, users are stuck. Mitigation: allow retry on error; log failures; consider a hard timeout that lets users through if the API is down.

## Migration Plan

1. Add Supabase migration: create `user_profiles` table with RLS
2. Deploy backend profile endpoints
3. Deploy frontend modal (feature-flagged if needed)
4. Existing users see modal on next sign-in

Rollback: drop the modal guard check; `user_profiles` table is additive and safe to leave unpopulated.

## Open Questions

- Should "parent" role have distinct prompt personalisation vs. "learning on my own"? (Currently treated the same — both are learner-context users.)
- Do we surface completion rate in any admin/analytics view, or is DB queryable sufficient for now?
