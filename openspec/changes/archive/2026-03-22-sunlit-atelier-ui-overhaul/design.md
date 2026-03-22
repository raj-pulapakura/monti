## Context

Monti's current web UI already contains warm brand-adjacent primitives (beige paper surfaces, rounded geometry, orange accent) but applies them inconsistently across home, chat runtime, sandbox preview, marketing, and auth routes. The current system mixes visual voices (warm editorial surfaces and neutral gray placeholders), operational copy intended for internal/runtime contexts, and uneven loading/status patterns that reduce perceived polish.

This change introduces a cross-cutting UI foundation that unifies visual language and user-facing feedback while preserving existing backend contracts and core product flows.

## Goals / Non-Goals

**Goals:**
- Establish a cohesive Sunlit Atelier design language with reusable semantic tokens.
- Introduce a two-role typography system: expressive cursive for display emphasis and sans-serif for all functional UI text.
- Standardize component and system-state feedback patterns (loading, empty, success, error, reconnecting, retry).
- Replace low-signal infrastructure-centric copy with concise creator-oriented language that fits an educational studio product.
- Apply the system consistently across marketing, home workspace, chat thread runtime, sandbox preview, and auth pages.

**Non-Goals:**
- Changing backend APIs, runtime event contracts, or persistence behavior.
- Re-architecting route topology or auth provider support.
- Shipping dark mode in this iteration.
- Building a standalone multi-package design-system library.

## Decisions

### Decision: Adopt semantic design tokens as the single styling contract
The web app will define a semantic token map for `surface`, `content`, `border`, `brand`, `state`, `elevation`, and `motion` and use those tokens across all first-party screens.

Rationale:
- Current style drift comes from local hardcoded values and ad hoc state styling.
- Semantic token naming allows consistent theming without coupling components to raw color values.

Alternatives considered:
- Keep existing variables and patch individual screens: rejected due to continued divergence.
- Build screen-specific token sets: rejected because cross-screen reuse and consistency are the primary goals.

### Decision: Use a constrained dual-type hierarchy
The UI will use a readable sans-serif family as the default type system and a cursive family only for high-emphasis display moments (hero headings, highlighted phrases, select section anchors).

Rationale:
- Supports the "genius studio" personality while preserving readability and scannability.
- Prevents decorative type from degrading form legibility and status clarity.

Alternatives considered:
- Serif + sans pairing: rejected for this iteration because cursive display better matches desired handcrafted studio tone.
- Full cursive adoption: rejected for accessibility and reading-speed concerns.

### Decision: Normalize state communication with a shared status model
State communication will use a single vocabulary and pattern family for status chips, inline notices, banners, and loading placeholders.

Rationale:
- Current runtime/status messaging is inconsistent and system-internal.
- A shared model improves user trust and lowers interpretation effort.

Alternatives considered:
- Keep route-specific status treatments: rejected because users move across surfaces and need consistent feedback semantics.

### Decision: Convert long waits from generic spinners to progressive feedback
Long-running operations (thread hydration, generation, sandbox updates) will surface progressive, human-readable status text and skeleton/pulse placeholders instead of only static loading strings.

Rationale:
- Reduces uncertainty and perceived wait time.
- Better aligns with educational/creative flow and reduces "is it broken?" ambiguity.

Alternatives considered:
- Keep static loading labels only: rejected for weak perceived responsiveness.

### Decision: Roll out by foundation-first sequence
Implementation will proceed in this order:
1. Shared tokens + typography + motion primitives.
2. Shared state/copy primitives.
3. Home + marketing alignment.
4. Chat + sandbox alignment.
5. Auth flow alignment and sweep.

Rationale:
- Minimizes regressions by stabilizing shared primitives before page-level refactors.
- Supports incremental QA and easier rollback.

## Risks / Trade-offs

- [Risk] Overusing cursive display text harms readability and accessibility. → Mitigation: constrain cursive to display roles only; keep controls/status/body in sans-serif.
- [Risk] Warm palette adjustments may reduce contrast on beige surfaces. → Mitigation: validate contrast for all text/state tokens and tune semantic values before rollout completion.
- [Risk] Runtime copy simplification may hide information useful during troubleshooting. → Mitigation: preserve actionable error detail in banners and retain deterministic retry affordances.
- [Risk] Cross-cutting CSS updates can cause regressions in responsive behavior. → Mitigation: enforce mobile/desktop QA checkpoints after each rollout phase.
- [Trade-off] Tight visual consistency limits per-screen visual experimentation. → Mitigation: allow controlled accents within token boundaries.

## Migration Plan

1. Introduce Sunlit Atelier token and typography primitives in shared styles.
2. Replace ad hoc status/loading/error styles with unified component patterns.
3. Update home + marketing surfaces to the new hierarchy and copy model.
4. Update chat + sandbox runtime surfaces to unified status/loading treatments.
5. Update sign-in/sign-up/forgot/reset auth surfaces for consistent tone and feedback.
6. Execute regression checks for route behavior, auth flows, thread creation/resume, runtime streaming visibility, and responsive layouts.

Rollback strategy:
- Revert frontend style and route-level UI commits in reverse order of rollout (auth/chat/home/foundation).
- Because there are no schema or API contract changes, rollback is code-only and does not require data migration.

## Open Questions

- Final font family selection for production (license, network performance, and fallback behavior).
- Whether advanced runtime diagnostics should remain visible in standard UI or move behind a developer-only affordance.
- Whether to introduce lightweight bespoke illustration assets in this change or defer to a follow-on enhancement.
