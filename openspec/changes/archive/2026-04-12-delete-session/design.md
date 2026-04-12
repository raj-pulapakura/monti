## Context

Sessions (chat threads) accumulate indefinitely with no removal mechanism. The `chat_threads` table already has an `archived_at` column that is filtered out in `listThreads` but is never set — soft-delete is a zero-migration addition.

The UI has two surfaces that need delete access: the library grid (home page `CreationCard` components) and the sandbox header (`SandboxHeader` on `/chat/:threadId`). A third surface — the 3-dot overflow menu on `CreationCard` — also surfaces Rename, which currently only exists inside the sandbox header.

## Goals / Non-Goals

**Goals:**
- Soft-delete a thread by setting `archived_at` via `DELETE /api/chat/threads/:id`
- Surface delete in the library via a 3-dot overflow menu on each `CreationCard`
- Surface delete in the sandbox header via a dedicated button
- Show a reusable `ConfirmModal` before executing the delete in either flow
- Surface rename in the library 3-dot menu (same action as the sandbox pencil icon)
- Redirect to `/` after sandbox delete

**Non-Goals:**
- Restore/undo after deletion
- Bulk delete
- Hard-delete or data purge
- Admin-side delete

## Decisions

### Soft-delete via `archived_at` (not hard-delete)
`archived_at` is already on `chat_threads` and the `listThreads` query already excludes non-null values. Setting it is safer, recoverable by support, and requires no migration. Hard-delete would cascade cleanly but is irreversible.

### Backend: `DELETE /api/chat/threads/:id` sets `archived_at = now()`
Follows REST semantics for delete while keeping the row. The endpoint asserts user ownership before writing. Returns `{ ok: true }` on success.

New additions in the backend:
- `ChatRuntimeRepository.archiveThread({ threadId, userId })` — sets `archived_at`, asserts ownership via `user_id` match
- `ChatRuntimeService.deleteThread(...)` — thin delegation
- `@Delete(':threadId')` route in `ChatRuntimeController`

### Frontend: Optimistic removal on the home page
Library removes the card from `threads[]` state immediately on confirm (before the API call completes), matching the existing pattern in `handleThreadFavouriteToggle`. On error, restore the thread and show an error banner. This avoids a perceptible lag given the list can be large.

### Frontend: Block-until-done on the sandbox page
After the user confirms from the sandbox header, wait for the API response before navigating to `/`. Show a loading state on the Delete button during the call. No optimistic nav — the user is leaving anyway and race conditions are not a concern.

### `ConfirmModal` as a new shared component
No modal component exists in the codebase. A new `web/app/components/confirm-modal.tsx` with props: `title`, `message`, `confirmLabel` (default "Delete"), `onConfirm`, `onCancel`, `isPending`. Rendered at the bottom of `HomeWorkspace` and `ThreadPage` conditionally (null when no pending delete).

### 3-dot menu on `CreationCard` using existing `useDropdownMenu` hook
`useDropdownMenu` already handles click-outside dismiss and Escape key. The trigger button uses `event.stopPropagation()` to prevent card navigation (same pattern as the star button). Menu items: **Rename** and **Delete**. Both callbacks are passed from `HomeWorkspace` into `CreationCard`.

### Rename from library: open inline editing in sandbox
`CreationCard` currently has no inline edit capability. Rather than building full inline rename on the card, the Rename option in the 3-dot menu navigates to `/chat/:threadId` and immediately enters title-edit mode via a URL param or session-storage flag. This reuses the existing sandbox title editing flow and avoids duplicating inline edit state on the home page.

Alternative considered: inline rename directly on the card. Rejected — adds significant state complexity to `CreationCard` (input, save/cancel, pending, error) and the sandbox already has a polished implementation.

## Risks / Trade-offs

- **Rename via navigation**: clicking Rename navigates away from home, which may feel heavy for a simple rename. Mitigated by the fact that the sandbox already gives full edit context and it's the path of least new code.
- **Optimistic removal with slow network**: if the user navigates to the deleted thread URL before the API resolves, the thread still exists in the DB and will hydrate normally. On success the DB sets `archived_at` and next list load excludes it. No inconsistency window is user-visible.
- **Concurrent delete**: if two sessions delete the same thread simultaneously, the second `archiveThread` call will find `archived_at` already set. Idempotent — both succeed.

## Migration Plan

No database migration required. `archived_at` already exists on `chat_threads`.

Deploy order: backend first (new endpoint), then frontend. The frontend will fail gracefully (no delete button visible) before the backend is deployed, since both surfaces are additive.
