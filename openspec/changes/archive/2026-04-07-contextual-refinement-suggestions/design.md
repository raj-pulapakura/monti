## Context

The chat workspace already supports iterative refinement, but the only prompt shortcuts in the composer are static generic pills (`quiz`, `game`, `explainer`, audience words). They do not respond to what was just generated. Meanwhile the runtime already tracks `sandboxState.experienceVersionId`, exposes active experience metadata through the sandbox preview endpoint, and has a backend LLM routing layer that can perform structured low-latency generations.

The requested behavior is intentionally narrow:

- suggestions appear after every successful version increment
- suggestions live near the composer only
- clicking a suggestion sets composer text but does not auto-submit
- suggestions come from an LLM pass with clear, bounded context
- the static pills go away

## Goals / Non-Goals

**Goals:**

- Generate 2-4 contextual refinement suggestions tied to the currently active experience version.
- Refresh suggestions whenever `experienceVersionId` changes to a new ready version.
- Keep the chat composer usable if suggestion generation is slow, unavailable, or fails.
- Use a small structured-output LLM call on the backend rather than embedding logic in the client.

**Non-Goals:**

- Adding a second suggestion surface in the sandbox panel.
- Auto-submitting or appending suggestion text; the composer remains editable before send.
- Using the heavy generation model or the user's selected generation mode for suggestion generation.
- Persisting suggestions as first-class database records in v1.

## Decisions

### 1. Add a dedicated authenticated suggestion endpoint

- **Choice:** Add a new user-scoped backend endpoint under chat runtime, e.g. `GET /api/chat/threads/:threadId/refinement-suggestions?experienceVersionId=<id>`.
- **Rationale:** The feature is derived from thread-owned state, must respect auth boundaries, and should be callable independently of hydration and SSE.
- **Alternatives considered:** Folding suggestions into thread hydration (increases hydration cost and couples unrelated concerns), or generating suggestions in the browser (would expose model credentials / duplicate logic).

### 2. Trigger fetching on `experienceVersionId` changes

- **Choice:** The web chat page watches the active `sandboxState.experienceVersionId`; when it changes to a non-null ready version, the client requests new suggestions for that version and replaces any prior suggestion set.
- **Rationale:** This directly matches the product rule: refresh after every version increment. It also avoids tying suggestions to assistant text completion or other weaker proxies.
- **Alternatives considered:** Trigger on every assistant message (too noisy; not every message creates a new version), or trigger from sandbox slug changes (less direct than version ids).

### 3. Use a fast structured LLM call with bounded, explicit context

- **Choice:** Build a backend suggestion prompt from:
  - the active experience version's `title` and `description`
  - the current thread's most recent relevant user refinement intent (at minimum the latest accepted user message; optionally the immediately previous user turn if needed for continuity)
  - a bounded excerpt of learner-visible experience content derived from the latest version (for example, stripped visible text or headings extracted from HTML, capped to a small size)
- **Explicitly exclude:** raw CSS, raw JS, and full artifact source dumps in v1.
- **Rationale:** These fields communicate what the artifact is, what the user just asked for, and what the learner likely sees, without paying to send full implementation payloads.
- **Model choice:** use the backend's fast structured-generation route (current fast-tier model), low temperature, strict JSON schema.
- **Alternatives considered:** full HTML/CSS/JS context (too noisy and token-heavy), rules only (not contextual enough), or using the large generation model (too expensive for per-version sidecar calls).

### 4. Return compact structured suggestions

- **Choice:** Backend response returns a small list of objects like `{ label, prompt }`, where `label` is short chip copy and `prompt` is the full text inserted into the composer.
- **Rationale:** The UI needs compact chips, but the composer needs richer text than the chip label alone.
- **Alternatives considered:** chips with label only (too little precision once inserted), or plain strings only (forces UI truncation to stand in for intentional labels).

### 5. Remove static pills entirely

- **Choice:** Remove `ADDABLE_PROMPT_WORDS` from the chat composer UI once contextual suggestions are enabled.
- **Rationale:** Static and dynamic suggestion systems shown together would compete and undermine the meaning of "contextual".
- **Alternatives considered:** retaining static pills as fallback (acceptable only as an internal emergency fallback, not as the default steady-state UI).

### 6. Fail soft and keep the composer usable

- **Choice:** Suggestions load asynchronously and never block typing, sending, mode selection, or preview rendering. If a request fails, the UI may show no chips or a subtle unavailable state, but it MUST NOT surface a hard error banner that interrupts the thread workflow.
- **Rationale:** Suggestion generation is assistive, not critical path.

## Risks / Trade-offs

- **[Risk] Suggestions feel generic despite being model-generated** → Mitigation: include both latest user intent and bounded artifact summary, and validate output length / diversity server-side.
- **[Risk] Suggestion requests race during rapid successive refinements** → Mitigation: key requests by `experienceVersionId`, ignore stale responses on the client, and optionally memoize server results briefly by `(userId, threadId, experienceVersionId)`.
- **[Risk] Visible-text extraction from HTML misses important context** → Mitigation: rely first on `title` and `description`, and keep extracted HTML text as supplemental context only.
- **[Risk] Per-version LLM call adds latency/cost** → Mitigation: use the fast tier with low token budgets and keep the feature non-blocking.

## Migration Plan

1. Add backend endpoint and suggestion service behind the existing authenticated chat runtime surface.
2. Replace static composer pills in the web chat thread page with dynamic chips keyed by `experienceVersionId`.
3. Deploy without data migration; threads with no active experience version simply show no suggestions.

## Open Questions

- Whether v1 should show a lightweight loading shimmer / placeholder row while fetching, or only render once suggestions arrive.
- Whether the backend should include a very small generic fallback set when the LLM request fails, or simply return an empty suggestion list.
