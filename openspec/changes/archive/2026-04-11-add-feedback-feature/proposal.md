## Why

Users have no way to share feedback about their experience with Monti or the quality of individual AI responses. A structured feedback mechanism enables the team to identify pain points, validate response quality, and prioritise product improvements.

## What Changes

- Add a floating feedback button (bottom-right) visible on all authenticated pages — clicking it expands into a feedback surface where users can type and submit free-text feedback
- Add thumbs up / thumbs down buttons beneath each assistant message in the chat conversation — clicking either opens a modal prompting the user to describe what was satisfying or unsatisfying about the response
- Introduce a new `feedback` table in Supabase to persist both feedback types, capturing `user_id`, `kind`, and optional contextual references (`thread_id`, `message_id`, `experience_id`)
- Add a `POST /api/feedback` backend endpoint that validates and writes feedback rows

## Capabilities

### New Capabilities

- `general-feedback-button`: Floating button on all authenticated pages that expands into a feedback submission surface for free-text general feedback
- `message-feedback`: Thumbs up/down controls on assistant chat messages that open a prompted modal and persist message-level feedback with contextual identifiers

### Modified Capabilities

## Impact

- **Frontend**: New `FloatingFeedbackButton` client component added to root `layout.tsx`; `ConversationTimeline` updated to render `ThumbsBar` beneath assistant messages; new modals for both feedback surfaces
- **Backend**: New `feedback` NestJS module with controller, service, and repository; new `POST /api/feedback` route guarded by `AuthGuard`
- **Database**: New `feedback` migration adding the `public.feedback` table with RLS policy (`user_id = auth.uid()`)
- **No breaking changes**
