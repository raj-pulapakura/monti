## Why

After a new experience version appears, the chat workspace still offers the same generic `+ quiz / + game / + explainer` pills regardless of what was just generated. Educators need the product to suggest the next best refinement in context, at the exact moment they are deciding what to do next.

## What Changes

- Add a backend-generated contextual suggestion flow that produces a small set of refinement prompts for the current thread's active experience version.
- Refresh suggestions after every successful experience version increment so the chips stay aligned with the artifact the user is looking at.
- Replace the existing static composer pills with dynamic suggestion chips rendered near the composer only; do not add a second suggestion surface in the sandbox.
- Clicking a suggestion fills the composer with that suggestion text but does not auto-submit.
- Use a lightweight structured LLM pass with explicit, bounded context from the latest version and recent thread intent; failures must not block the chat workspace.

## Capabilities

### New Capabilities
- `contextual-refinement-suggestions`: Generate and display version-specific refinement suggestions for the chat composer after successful experience generations/refinements.

### Modified Capabilities
- _(none)_

## Impact

- **Backend**: chat runtime controller/service, new suggestion-generation service, LLM structured-output call, user-scoped endpoint, optional short-lived caching keyed by thread + experience version.
- **Web**: `web/app/chat/[threadId]/page.tsx` composer area, removal of static `ADDABLE_PROMPT_WORDS` pills, loading/error handling for dynamic chips.
- **UX**: suggestions appear only near the composer, refresh when `experienceVersionId` changes, and set composer text on click without sending.
