## Context

The authenticated home workspace (`/` when signed in) already has a primary create textarea and thread carousel. Product wants **example prompts** that fill the input on click, visible **whenever** the user is on home—not only on first run or empty library. A **static trio** would feel repetitive; we use a **pool** and show **three** entries per render using a **deterministic** selection so the UI does not shuffle on every navigation within the same day.

## Goals / Non-Goals

**Goals:**

- Ship a client-only pool of example strings and a small selection helper.
- Render **three** controls (chips or text buttons) **below or beside** the create input, consistent with `.home-create-form` / Sunlit Atelier.
- On click: **replace** textarea value with that prompt (same state as typing); focus the textarea for immediate edit/submit.
- Selection rule: **stable for a given user on a given calendar day (UTC)** and **varies across days and users** without server round-trips.

**Non-Goals:**

- Auto-submitting the form when a chip is clicked.
- Persisting “which prompts were shown” or A/B telemetry in v1.
- Admin-editable copy or i18n (hardcoded pool in code is acceptable for v1).
- Backend APIs or feature flags for this feature.

## Decisions

### 1. Rotation seed: UTC calendar date + stable user id

- **Choice:** Compute `seed = hash( userId + ":" + YYYY-MM-DD UTC )` (e.g. 32-bit FNV-1a or string hash—implementation detail).
- **Rationale:** Same user sees the **same three prompts** for the whole UTC day (refresh-safe, navigate-safe). Different users get different triples from the same pool. Advancing the calendar day changes the triple without random jitter.
- **Alternatives considered:** Random on mount (rejected: flicker). Day-only seed (rejected: all users same triple per day). User-only seed (rejected: never rotates).

### 2. Picking three distinct prompts from the pool

- **Choice:** With pool length `N ≥ 3`, map `seed` to a starting index `i = seed mod N`, then take prompts at indices `i`, `(i+1) mod N`, `(i+2) mod N` (distinct if `N ≥ 3`). If `N < 3` (should not happen), pad or show all—guard in code.
- **Rationale:** Simple, no allocation of a full shuffle; adjacent entries in a curated list can be thematically related—if we want more spread, a follow-up can use modular offsets `k, 2k, 3k` with coprime step.
- **Alternatives considered:** Full Fisher–Yates from seeded PRNG (more code; can adopt if we need better distribution).

### 3. UI and a11y

- **Choice:** `<button type="button">` per suggestion; optional `aria-label` if visible text is truncated.
- **Rationale:** Avoid accidental form submit; keyboard and screen readers behave predictably.

### 4. Module layout

- **Choice:** `web/lib/home-example-prompts.ts` (or similar) exporting `EXAMPLE_PROMPT_POOL` and `pickHomeExamplePrompts({ userId, now }): [string, string, string]`.
- **Rationale:** Keeps `page.tsx` thinner and allows a tiny unit test on the picker if the repo already tests pure helpers.

## Risks / Trade-offs

- **[Risk] UTC day boundary** → Users may notice the set change at midnight UTC, not local midnight. **Mitigation:** Document in code comment; optional later switch to local date via `Intl` if product asks.
- **[Risk] Small pool** → Adjacent triples may feel similar. **Mitigation:** Curate pool size ≥ 9–12 with diverse intents.
- **[Risk] Long chip labels** → Layout wrap or truncate. **Mitigation:** CSS `line-clamp` or max-width chips; full text still applied to textarea on click.

## Migration Plan

N/A (additive UI). Deploy with web only; no data migration.

## Open Questions

- Exact marketing copy for the pool (product/content)—placeholder strings acceptable in implementation PR.
