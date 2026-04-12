## 1. Backend — archive endpoint

- [x] 1.1 Add `archiveThread({ threadId, userId })` to `ChatRuntimeRepository` — sets `archived_at = now()`, asserts ownership, idempotent
- [x] 1.2 Add `deleteThread({ threadId, userId })` to `ChatRuntimeService` — thin delegation to repository
- [x] 1.3 Add `@Delete(':threadId')` route to `ChatRuntimeController` — calls service, returns `{ ok: true }`
- [x] 1.4 Wire any needed DTO parsing (reuse `parseHydrateThreadRequest` for threadId extraction)

## 2. Frontend — shared ConfirmModal component

- [x] 2.1 Create `web/app/components/confirm-modal.tsx` with props: `title`, `message`, `confirmLabel` (default "Delete"), `isPending`, `onConfirm`, `onCancel`
- [x] 2.2 Style the modal (overlay + dialog, destructive confirm button, disabled+loading state on pending)
- [x] 2.3 Wire Escape key to `onCancel` inside the modal

## 3. Frontend — library card overflow menu

- [x] 3.1 Add `onDelete` and `onRename` callback props to `CreationCard`
- [x] 3.2 Add 3-dot trigger button to `CreationCard` using `useDropdownMenu` hook; `stopPropagation` on click
- [x] 3.3 Render dropdown with Rename and Delete menu items; Rename calls `onRename`, Delete calls `onDelete`
- [x] 3.4 Style overflow menu button and dropdown to match existing card UI

## 4. Frontend — home page delete flow

- [x] 4.1 Add `handleThreadDelete(thread)` to `HomeWorkspace`: opens confirm modal, on confirm optimistically removes thread from state, calls `DELETE /api/chat/threads/:id`, restores on error
- [x] 4.2 Track delete-pending state (`deletePendingByThreadId`) to disable the confirm button during in-flight requests
- [x] 4.3 Render `ConfirmModal` at root of `HomeWorkspace` when a delete is pending confirmation
- [x] 4.4 Pass `onDelete` and `onRename` into each `CreationCard`

## 5. Frontend — home page rename flow

- [x] 5.1 Add `handleThreadRename(thread)` to `HomeWorkspace`: navigates to `/chat/:threadId` with a `rename=1` query param (or session-storage flag) to signal auto-activate title edit

## 6. Frontend — sandbox header delete button

- [x] 6.1 Add `onDelete` callback prop and `isDeletePending` boolean prop to `SandboxHeader`
- [x] 6.2 Render trash-icon Delete button in the sandbox header actions bar; disabled when `!activeExperience || isDeletePending`
- [x] 6.3 Wire delete button in thread page: opens confirm modal, on confirm calls API then `router.replace('/')`
- [x] 6.4 Render `ConfirmModal` in the thread page for the sandbox delete flow

## 7. Frontend — rename auto-activate in sandbox

- [x] 7.1 On thread page mount, read the `rename` query param (or session-storage flag); if set, immediately enter title-edit mode and clear the flag

## 8. Validation

- [ ] 8.1 Manual test: delete from library card — card disappears, network call succeeds, thread gone from next load
- [ ] 8.2 Manual test: delete from sandbox header — redirected to home, thread absent from library
- [ ] 8.3 Manual test: rename from library card — navigates to sandbox with edit mode active
- [ ] 8.4 Manual test: cancel in confirm modal — no API call made
- [ ] 8.5 Manual test: delete fails — card restored, error banner shown
