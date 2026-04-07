## 1. Backend suggestion flow

- [x] 1.1 Add an authenticated chat-runtime endpoint for contextual refinement suggestions scoped to a thread and active `experienceVersionId`
- [x] 1.2 Implement a backend suggestion service that loads bounded context (latest version title/description, recent user refinement intent, optional stripped visible-text excerpt) and calls the fast structured LLM route
- [x] 1.3 Validate and normalize the structured response into a small chip-safe payload (`label`, `prompt`) and fail soft on timeouts / malformed outputs

## 2. Chat composer UI

- [x] 2.1 Remove the static `ADDABLE_PROMPT_WORDS` pills from `web/app/chat/[threadId]/page.tsx`
- [x] 2.2 Track `sandboxState.experienceVersionId` changes, fetch contextual suggestions for the current version, and ignore stale responses when a newer version arrives
- [x] 2.3 Render the returned suggestion chips near the composer only and wire chip selection to replace composer text without auto-submitting

## 3. Validation

- [x] 3.1 Add focused backend tests for request parsing / auth scoping / response normalization for the suggestion endpoint or service
- [x] 3.2 Add focused web tests (or equivalent component-level checks) for version-driven suggestion refresh and chip click behavior
- [x] 3.3 Manually verify that suggestions refresh after each new version, static pills are gone, and the composer remains usable when suggestions are unavailable
  - [ ] Open an existing thread with a ready experience — confirm no static quiz/game/explainer pills appear
  - [ ] Send a refinement prompt and wait for a new experience version — confirm suggestion chips appear near the composer after the version lands
  - [ ] Send another refinement — confirm the old chips are replaced with new ones tied to the latest version
  - [ ] Temporarily block `/api/chat/threads/:id/refinement-suggestions` (e.g. via devtools) — confirm the composer remains fully usable with no error banner
  - [ ] Click a suggestion chip — confirm the composer text is set to the suggestion prompt but the message is NOT automatically sent
