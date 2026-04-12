## Why

Users have no way to remove sessions from their library. Over time the library accumulates unwanted experiments, which creates noise and degrades the experience of finding work they care about.

## What Changes

- New 3-dot overflow menu on each `CreationCard` in the library with **Delete** and **Rename** options
- New Delete button in the `SandboxHeader` for the active session
- New reusable `ConfirmModal` component used in both flows
- Soft-delete: sets `archived_at` on `chat_threads`; already filtered from list queries
- New `DELETE /api/chat/threads/:id` backend endpoint (performs soft-delete)
- After delete from sandbox, user is redirected to home (`/`)

## Capabilities

### New Capabilities
- `session-deletion`: Soft-delete a session from both the library card menu and the sandbox header, with a confirmation modal before the operation executes

### Modified Capabilities
- `home-screen-workspace`: Library cards gain an overflow menu (3-dot) with Delete and Rename actions
- `chat-thread-runtime`: New DELETE endpoint soft-deletes a thread by setting `archived_at`
- `experience-title-editing`: Rename action surfaces in the library card overflow menu (currently only available in sandbox header)

## Impact

- **Backend**: new `DELETE /api/chat/threads/:id` route, repository method `archiveThread`, service method `deleteThread`
- **Frontend – home page**: `CreationCard` gains overflow menu; `HomeWorkspace` gains `onDelete` handler and optimistic removal from `threads[]`; `onRename` wires to existing title-edit logic (or a new inline flow)
- **Frontend – sandbox**: `SandboxHeader` gains `onDelete` callback prop; thread page wires handler → `router.replace('/')`
- **Frontend – shared**: new `ConfirmModal` component
- **Database**: no migration needed; `archived_at` column already exists
