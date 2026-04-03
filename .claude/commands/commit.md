---
name: "Git: Commit"
description: Create one intentional commit from current changes
category: Workflow
tags: [git, workflow]
---

Create one intentional commit from current changes with minimal noise and a clear message.

**Input**: Optionally specify intent/scope (e.g., `/commit billing webhook fix`). If omitted, infer from conversation context and the actual diff; if changes look mixed, ask what to include.

**Workflow**

1. **Inspect repo state**

   ```bash
   git status --short
   git diff --name-only
   git diff --staged --name-only
   ```

2. **Decide what belongs in this commit**
   - Compare the diff to the user’s stated intent (or inferred intent).
   - Identify files that are clearly in-scope vs unrelated/noisy.
   - If intent is unclear or changes are mixed, pause and ask what to include.

3. **Stage only intended files**

   ```bash
   git add <path...>
   ```

4. **Review staged content**

   ```bash
   git diff --staged
   ```

5. **Compose a clean commit message**
   - Subject format: `<type>(<scope>): <summary>` (imperative mood)
   - Keep subject concise (about 72 chars max)
   - Add body bullets for rationale and validation when useful

   **Type guide**
   - `feat`: new behavior
   - `fix`: bug fix / regression fix
   - `refactor`: structural code change without behavior change
   - `test`: test additions/updates
   - `docs`: documentation-only changes
   - `chore`: maintenance/tooling changes

6. **Commit (non-interactive)**

   ```bash
   git commit -m "<type>(<scope>): <summary>" -m "<optional body>"
   ```

7. **Report back**
   - Commit hash and subject
   - Files included
   - Validation/tests run (or explicitly: not run)

**Guardrails**
- Do not include unrelated files unless the user explicitly asks.
- Do not use destructive git commands.
- If hooks or tools introduce unexpected file changes, stop and ask how to proceed.
- If there is nothing to commit, report that clearly and do not create an empty commit unless requested.
- Do not amend existing commits unless explicitly requested.
