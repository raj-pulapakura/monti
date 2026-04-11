## Context

Monti has no mechanism for users to submit feedback. The app has two authenticated surfaces where feedback makes sense: (1) any authenticated page (general sentiment), and (2) the chat conversation thread (per-message quality signal). There is no shared authenticated layout — each page manages its own auth state independently. All data mutations follow the pattern: frontend → authenticated NestJS backend → Supabase.

## Goals / Non-Goals

**Goals:**
- Self-contained `FloatingFeedbackButton` client island mountable in the root layout — works across all pages without per-page wiring
- Thumbs up/down controls on assistant messages with contextual identifiers (thread, message, experience)
- Single `POST /api/feedback` backend endpoint following existing NestJS module conventions
- Single `public.feedback` Supabase table with a `kind` discriminator covering both feedback surfaces

**Non-Goals:**
- Displaying or highlighting previously submitted feedback in the UI
- Admin dashboards or analytics over feedback data
- Feedback moderation, review, or response workflows
- Rate-limiting or deduplication of feedback submissions

## Decisions

### 1. Self-contained client island for the floating button

**Decision**: `FloatingFeedbackButton` calls `supabase.auth.getSession()` itself on submit rather than receiving an `accessToken` prop from the parent.

**Rationale**: There is no shared authenticated layout to thread auth context through. Rather than requiring each page to pass an access token, the component manages its own session. This keeps the root `layout.tsx` integration trivial (one import, one JSX tag) and avoids coupling a peripheral UI element to each page's auth state machine.

**Alternative considered**: Add an authenticated layout wrapper around all protected routes. Rejected — significant refactor unrelated to this feature's scope.

### 2. Single `feedback` table with `kind` discriminator

**Decision**: One table, `public.feedback`, with a `kind` column (`'general' | 'thumbs_up' | 'thumbs_down'`). Contextual FK columns (`thread_id`, `message_id`, `experience_id`) are nullable and only populated for message-level feedback.

**Rationale**: Both feedback surfaces are structurally identical (user, timestamp, text, optional context). A single table simplifies the migration, the backend service, and any future querying. The `kind` column makes filtering trivial.

**Alternative considered**: Two separate tables (`general_feedback`, `message_feedback`). Rejected — unnecessary complexity for functionally similar data.

### 3. Backend write over direct Supabase client write

**Decision**: Feedback is submitted via `POST /api/feedback` to the NestJS backend, which then writes to Supabase using the service-role client.

**Rationale**: Every other data mutation in the app goes through the backend. Bypassing this for feedback would introduce an inconsistent pattern and weaken the auditing story. The backend also lets us validate and normalize the payload before it hits the DB.

### 4. Ephemeral thumbs state

**Decision**: The thumbs up/down UI maintains no loaded state. Each page load starts fresh. A second click on the same message inserts a new row rather than updating.

**Rationale**: The feedback signal is append-only by design — the team wants volume of signals, not a single canonical rating per message. Highlighting prior selections would require loading feedback history on thread hydration, adding query cost and complexity for minimal user value.

### 5. Thumbs feedback wired via callback prop on `ConversationTimeline`

**Decision**: The chat page passes an `onMessageFeedback` callback to `ConversationTimeline`, which forwards it to each `ThumbsBar` beneath assistant messages.

**Rationale**: Consistent with the existing prop-drilling pattern in this codebase. Avoids introducing a context or global store for a simple event handler. The chat page already holds `accessToken`, `threadId`, and `activeExperience` — exactly what's needed to build the feedback payload.

## Risks / Trade-offs

- **No deduplication** → Users can submit unlimited feedback on the same message. Acceptable for an early-stage signal collector; can add rate-limiting later if signal quality degrades.
- **Session fetch on submit** → `FloatingFeedbackButton` fetches the session at submit time, not mount time. If the session has expired, submission will fail silently. Mitigation: surface an error state in the modal and prompt re-login.
- **Nullable FK columns** → General feedback rows have null `thread_id`, `message_id`, `experience_id`. Queries must filter by `kind` to avoid mixing surfaces. Mitigation: enforce at the backend layer — general feedback payload must not include message-level fields.

## Migration Plan

1. Deploy DB migration (new `feedback` table + RLS) — no rollback risk, additive only
2. Deploy backend with new `feedback` module — gated behind `AuthGuard`, no breaking changes
3. Deploy frontend with `FloatingFeedbackButton` in root layout and `ThumbsBar` in conversation timeline
4. No rollback needed for steps 1–2; step 3 is UI-only and can be reverted by removing the component import
