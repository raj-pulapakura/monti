---
name: clickup
description: This skill should be used when the user asks to look up ClickUp tasks or ClickUp Docs from task IDs, custom task IDs, doc IDs, doc links, or plain-language queries; fetch task and document details through the ClickUp API; distinguish active work tasks from supporting docs; and optionally update main, create or switch to a feature branch, and prepare an implementation plan. Authentication uses PERSONAL_CLICKUP_API_TOKEN and PERSONAL_CLICKUP_TEAM_ID for a personal ClickUp workspace.
---

# ClickUp (personal workspace)

Use this skill to fetch ClickUp context first, including both tasks and ClickUp Docs, and only escalate into branching and planning when the user wants active work to begin.

## Modes

- **Retrieval mode**: fetch and summarize tasks and supporting context only
- **Action-plan mode**: fetch tasks, update `main`, create or switch to a feature branch, inspect the codebase, and produce an implementation plan

Mode selection rules:

- If the user explicitly asks to fetch, retrieve, summarize, or gather context only, use Retrieval mode.
- If the user asks to start work, plan, implement, or supplies task IDs as active work items without a retrieval-only instruction, default to Action-plan mode.
- If it is unclear whether the user wants retrieval only or planning, ask before branching.

## Inputs

Expect one or more of these:

- ClickUp task IDs
- ClickUp custom task IDs
- short natural-language task queries
- ClickUp Doc IDs
- ClickUp Doc links
- short natural-language doc queries
- other supporting context

Definitions:

- **Tasks** drive branch naming and the implementation plan.
- **Docs** are supporting context only and never affect the branch name by themselves.

If the prompt mixes tasks and docs and that distinction changes branch naming or action scope, confirm with the user before proceeding.

## Prerequisites

- Require `PERSONAL_CLICKUP_API_TOKEN` in the shell environment.
- Prefer `PERSONAL_CLICKUP_TEAM_ID` in the shell environment. It is required for workspace-wide search and for resolving custom task IDs when the token can access multiple Workspaces.
- Require the current directory to be a git repository before creating a branch in Action-plan mode.
- Use [references/clickup-api.md](references/clickup-api.md) only when auth or endpoint behavior needs clarification.

Do not ask the user to paste secrets into chat if a normal shell environment variable is sufficient.

## Workflow

1. **Classify refs and choose mode**

   Separate the user input into:

   - active work tasks
   - supporting docs or contextual references

   If there are no active tasks, stay in Retrieval mode unless the user explicitly asks to start work anyway.

2. **Resolve the active task refs and supporting docs**

   Use the helper script in this skill directory. From the repository root (or any path inside the repo), run:

   ```bash
   python3 "$(git rev-parse --show-toplevel)/.claude/skills/clickup/scripts/resolve_clickup_task.py" --json "task:<task-ref-1>" "task:<task-ref-2>" "doc:<doc-ref-1>"
   ```

   Use `task:` and `doc:` prefixes whenever classification matters. Unprefixed refs are treated as auto-detect and may require confirmation if the intent is unclear.

   Rules:

   - Treat direct task ID, custom task ID, and doc ID matches as authoritative.
   - The helper can resolve multiple task and doc refs in a single call and returns a combined `branch_name` based only on active tasks.
   - If any task or doc query is ambiguous, show at most 3 candidates for that query and ask the user to choose before continuing.
   - If a task or doc query has no match, ask the user for a narrower query.
   - Keep docs separate from resolved tasks in your summary.

3. **Summarize tasks and docs before touching code**

   For each resolved task, pull:

   - task ref
   - task title
   - status
   - assignees
   - list / folder / space
   - due date and priority if present
   - ClickUp URL
   - description
   - checklist items
   - attachment metadata
   - downloaded image attachment paths
   - OCR previews when available

   Convert that into:

   - the engineering goal
   - likely acceptance criteria
   - explicit unknowns, contradictions, or missing product detail

   If the task description is empty, thin, or clearly incomplete, treat task attachments as required context before planning. For image attachments:

   - use the downloaded local image paths from the helper output
   - inspect the image directly when the runtime supports image understanding
   - use OCR previews from the helper as fallback text context
   - explicitly note when image-only context still needs human clarification

   For each resolved doc, pull:

   - doc ID
   - doc title
   - ClickUp URL if present
   - page list
   - page content previews when available

   Present supporting docs and contextual references in a separate section so they are not confused with active work tasks.

4. **Stop here in Retrieval mode**

   If the mode is Retrieval and the user did not ask to start work, stop after the task/context summary.

5. **Update `main`, then create or switch to the feature branch**

   Action-plan mode only.

   Read the current git state first:

   ```bash
   git status --short --branch
   ```

   Use the combined `branch_name` from the resolver output. That branch name must incorporate every active task reference and exclude docs.

   Mandatory flow:

   ```bash
   git fetch origin main
   git switch main
   git pull --ff-only origin main
   ```

   Then:

   - If the branch already exists locally, switch to it from `main` with `git switch <branch>`.
   - Otherwise create it from updated `main` with `git switch -c <branch>`.
   - Never create the feature branch from the current `HEAD` unless `HEAD` is already the updated local `main`.
   - Never reset, stash, or discard user changes just to make branch creation easier.
   - If local changes prevent switching to `main`, stop and ask the user how to handle the worktree instead of forcing the checkout.

6. **Build codebase context**

   Use the resolved task titles, keywords, affected domain terms, and IDs to search the repo.

7. **Prepare the implementation plan**

   Produce a plan with these sections:

   - Goal
   - Relevant code areas
   - Proposed implementation steps
   - Validation and test plan
   - Open questions or blockers

   Default behavior: if the user supplied active task IDs and did not ask for retrieval only, produce the plan.

   If the user explicitly asked to keep going and implement immediately, continue from the plan without re-resolving the ClickUp tasks unless the references changed.

## Output Shape

When the skill completes, show:

- the resolved tasks
- supporting docs and context separately
- which mode was used
- the branch that was created or switched to in Action-plan mode
- the implementation plan in Action-plan mode
- any blockers that need product or technical clarification

## Guardrails

- Prefer the helper script over hand-written API calls.
- Prefer `rg` over slower search tools.
- Only active task refs participate in branch naming. Docs never do.
- If multiple refs were supplied and it is unclear which are tasks versus docs, confirm before branching.
- Do not ignore task attachments when they contain the primary implementation context.
- Do not start coding if any active task or required doc is unresolved or ambiguous.
- Do not overwrite or revert unrelated local changes.
- If the repository is not a git repo, skip branching and still provide the summary or plan.
- Always fetch and fast-forward `main` before switching to or creating the feature branch.

## Example Invocations

- Look up ClickUp task `CU-482` (retrieval)
- Start work on `CU-482` and `CU-490` (action-plan)
- Fetch context for `CU-482` and the release checklist doc only
- Look up "daily digest loading state" only
- Retrieve `doc:Release Checklist` and `task:CU-482`
