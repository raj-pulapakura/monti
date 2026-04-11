## 1. Database Migration

- [x] 1.1 Create migration file `supabase/migrations/<timestamp>_add_feedback_table.sql` with `public.feedback` table (`id`, `user_id`, `kind`, `message`, `thread_id`, `message_id`, `experience_id`, `created_at`)
- [x] 1.2 Add FK constraints: `user_id → auth.users`, `thread_id → chat_threads`, `message_id → chat_messages`, `experience_id → experiences` (all nullable except `user_id`)
- [x] 1.3 Add check constraint on `kind` column: `('general', 'thumbs_up', 'thumbs_down')`
- [x] 1.4 Add RLS policy: enable RLS, insert policy `user_id = auth.uid()`, no select/update/delete for users
- [x] 1.5 Update `supabase/schemas/experiences.sql` to include the `feedback` table definition

## 2. Backend — Feedback Module

- [x] 2.1 Create `backend/src/feedback/` module directory with `feedback.module.ts`, `feedback.controller.ts`, `feedback.service.ts`, `feedback.repository.ts`
- [x] 2.2 Implement DTO parsing in `feedback.controller.ts`: validate `kind` enum, optional `message` (string | null), optional `thread_id`, `message_id`, `experience_id` (UUIDs)
- [x] 2.3 Implement `FeedbackRepository.insert()` that writes a row to `public.feedback` using the Supabase service-role client
- [x] 2.4 Implement `FeedbackService.submit()` that calls the repository and returns void
- [x] 2.5 Implement `POST /api/feedback` route in `FeedbackController`, guarded by `AuthGuard`, calling `FeedbackService.submit()` with `userId` from `@CurrentUser()`
- [x] 2.6 Register `FeedbackModule` in `app.module.ts`

## 3. Frontend — Shared Feedback Lib

- [x] 3.1 Create `web/lib/feedback/submit-feedback.ts` with a typed `submitFeedback(accessToken, payload)` function calling `POST /api/feedback` via `createAuthenticatedApiClient`
- [x] 3.2 Define the `FeedbackPayload` type (`kind`, `message`, `thread_id?`, `message_id?`, `experience_id?`)

## 4. Frontend — Floating General Feedback Button

- [x] 4.1 Create `web/app/components/floating-feedback-button.tsx` as a `'use client'` component that checks `supabase.auth.getSession()` and renders null if unauthenticated
- [x] 4.2 Implement the collapsed button state: fixed bottom-right position, feedback icon (e.g. `MessageSquare` from lucide-react), accessible label
- [x] 4.3 Implement the expanded feedback surface: text area, character-aware submit button (disabled when empty/whitespace), dismiss control
- [x] 4.4 Wire submit: call `submitFeedback` with `{ kind: 'general', message }`, show in-flight disabled state, close on success, show error message on failure
- [x] 4.5 Add `<FloatingFeedbackButton />` to `web/app/layout.tsx`
- [x] 4.6 Add CSS for the floating button and expanded surface to `globals.css`

## 5. Frontend — Message Thumbs Feedback

- [x] 5.1 Create `web/app/chat/[threadId]/components/thumbs-bar.tsx` with thumbs up and thumbs down buttons and an `onFeedback(kind: 'thumbs_up' | 'thumbs_down') => void` prop
- [x] 5.2 Create `web/app/chat/[threadId]/components/message-feedback-modal.tsx`: accepts `kind`, `prompt` text, `onSubmit(message: string | null) => void`, `onDismiss`, error state — renders a modal with prompted text area and submit/dismiss controls
- [x] 5.3 Update `ConversationTimeline` to accept an `onMessageFeedback?: (messageId: string, kind: 'thumbs_up' | 'thumbs_down', message: string | null) => void` prop and render `<ThumbsBar>` beneath each `role === 'assistant'` message
- [x] 5.4 Add modal state management inside `ConversationTimeline` (or lift to page): track which `messageId` + `kind` is pending modal open, render `<MessageFeedbackModal>` conditionally
- [x] 5.5 Wire `onMessageFeedback` in `chat/[threadId]/page.tsx`: build the feedback payload with `threadId`, `messageId`, `activeExperience?.generationId` (mapped to `experience_id`), call `submitFeedback`
- [x] 5.6 Add CSS for `ThumbsBar` and `MessageFeedbackModal` to `globals.css`
