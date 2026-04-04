# ClickUp API Notes

Use this reference only when the helper script or environment setup needs clarification.

## Environment (this repo)

- `PERSONAL_CLICKUP_API_TOKEN`: required — personal ClickUp API token
- `PERSONAL_CLICKUP_TEAM_ID`: recommended and often required for workspace-wide search and custom task IDs when the token can access multiple Workspaces
- `CLICKUP_API_BASE` / `CLICKUP_API_BASE_V2`: optional v2 override, defaults to `https://api.clickup.com/api/v2`
- `CLICKUP_API_BASE_V3`: optional v3 override, defaults to `https://api.clickup.com/api/v3`
- `CLICKUP_ATTACHMENT_DIR`: optional directory for downloaded task images
- `CLICKUP_MAX_IMAGE_DOWNLOADS`: optional cap per task (default `4`)

If the token can access exactly one Workspace, the helper script can discover the team ID automatically by calling `GET /api/v2/team`.

In ClickUp's API terminology, `team_id` in v2 is the same top-level Workspace ID used as `workspace_id` in v3.

## Endpoints Used

- `GET /api/v2/team`
  Discover the Workspaces available to the authenticated user.
  Docs: [Get Authorized Workspaces](https://developer.clickup.com/reference/getauthorizedteams)

- `GET /api/v2/task/{task_id}`
  Resolve a task directly when the user gives a normal ClickUp task ID. Tasks with file attachments can include attachment metadata in the task response.
  Docs: [Get Task](https://developer.clickup.com/reference/gettask)

- `GET /api/v2/task/{task_id}?custom_task_ids=true&team_id=<workspace>`
  Resolve a task when the user gives a custom task ID.
  Docs: [Get Task](https://developer.clickup.com/reference/gettask)

- `GET /api/v2/team/{team_id}/task`
  Search tasks across the Workspace. The helper script first tries the endpoint with a `search` query and falls back to a smaller client-side scan if that fails.
  Docs: [Get Filtered Team Tasks](https://developer.clickup.com/reference/getfilteredteamtasks)

- `GET /api/v3/workspaces/{workspace_id}/{entity_type}/{entity_id}/attachments`
  Retrieve attachments for a supported parent entity such as a task. This is a fallback reference for attachment-aware task context.
  Docs: [Get Attachments](https://developer.clickup.com/reference/getparententityattachments)

- `GET /api/v3/workspaces/{workspace_id}/docs`
  Search Docs across the Workspace.
  Docs: [Search for Docs](https://developer.clickup.com/reference/searchdocspublic)

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}`
  Fetch Doc metadata.
  Docs: [Fetch a Doc](https://developer.clickup.com/reference/getdocpublic)

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
  List the pages that belong to a Doc.
  Docs: [Fetch Pages belonging to a Doc](https://developer.clickup.com/reference/getdocpagespublic)

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`
  Fetch page content for previews.
  Docs: [Get page](https://developer.clickup.com/reference/getpagepublic)

## Output Contract

`scripts/resolve_clickup_task.py --json "<ref1>" "<ref2>"` returns:

- `tasks`: the resolved active ClickUp tasks
- `docs`: the resolved ClickUp Docs
- `task`: the single resolved task when only one task matched
- `doc`: the single resolved doc when only one doc matched
- `attachment_dir`: the base directory used for downloaded task images
- `branch_name`: a combined branch name based on all resolved task refs
- `unresolved_refs`: task or doc refs that still need confirmation
- `ambiguous`: whether any unresolved ref is ambiguous

Refs may be prefixed with `task:` or `doc:` to force the resolution kind. Unprefixed refs are auto-detected.

Each resolved task may include:

- `attachments`: attachment metadata for the task
- `local_path`: absolute path for downloaded image attachments
- `ocr_text_preview`: OCR text when `tesseract` is available locally
