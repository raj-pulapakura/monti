## 1. Pool and selection helper

- [x] 1.1 Add `web/lib/home-example-prompts.ts` (or agreed path) with a curated `EXAMPLE_PROMPT_POOL` (length ≥ 9) and `pickHomeExamplePrompts({ userId, now })` implementing UTC day + user id seed and three distinct strings per design.md
- [x] 1.2 Add a minimal unit test for the picker if the web test stack already covers pure TS helpers (determinism same day, changes when date changes, distinct outputs)

## 2. Home UI

- [x] 2.1 In `HomeWorkspace` (`web/app/page.tsx`), derive `userId` (or stable session subject) and compute the three prompts; render controls between create input and thread carousel (or directly under the create row per layout)
- [x] 2.2 Wire each control to `setPrompt(fullText)` and focus the textarea; use `<button type="button">` and keyboard-friendly markup
- [x] 2.3 Add scoped styles in `web/app/globals.css` for chips/wrap/truncation consistent with Sunlit Atelier

## 3. Verification

- [x] 3.1 Manual check: signed-in `/` shows three starters; click fills input without submit; reload same day keeps same trio; sign-in as another user may differ
- [x] 3.2 Run web lint/tests touched by the change
