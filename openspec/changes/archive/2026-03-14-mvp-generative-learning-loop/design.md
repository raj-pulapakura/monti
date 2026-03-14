## Context

Monti currently has scaffolded backend (NestJS) and frontend (Next.js) projects but no implemented product loop. The MVP must validate a single user journey: prompt to generated interactive learning experience to play to refine. The existing inspiration material proves key generation patterns (schema-constrained JSON output, provider abstraction, retry on token limits, and robust parsing) and should be adapted rather than reinvented.

Constraints:
- MVP excludes auth, payments, cloud persistence, collaboration, and template libraries.
- Generated code must run safely inside an iframe and avoid external libraries/network calls.
- UX must tolerate variable LLM latency while remaining synchronous for MVP scope.
- Implementation should favor a layered module architecture that can evolve without full rewrites.

Stakeholders:
- Product owner validating core user value quickly.
- End users creating and refining educational interactions.
- Engineering team that will iterate post-MVP.

## Goals / Non-Goals

**Goals:**
- Implement synchronous generation and refinement APIs returning structured `html`/`css`/`js` payloads.
- Provide deterministic backend orchestration with validation, retries, and safety checks.
- Render generated output in sandboxed iframe and support local recent-creations history.
- Keep architecture modular enough to support future model routing improvements and eventual async execution.

**Non-Goals:**
- Account systems, billing, sharing, collaboration, or server-side user data storage.
- Full moderation platform or comprehensive static-analysis sandbox engine.
- Asynchronous job queues and background workers.
- Large-scale analytics/observability platform beyond MVP logging.

## Decisions

### Decision 1: Use layered backend modules (Design B) in NestJS
- Choice: implement `generation`, `refinement`, `llm`, `validation`, and `safety` responsibilities as focused modules coordinated by orchestration services.
- Rationale: faster than a generic pipeline framework but avoids monolithic service growth.
- Alternatives considered:
- Single monolithic generation service: faster initial coding but high coupling and harder testing.
- Policy pipeline engine: best long-term extensibility but over-engineered for MVP timeline.

### Decision 2: Use structured output contracts with provider-native JSON schema where available
- Choice: require model responses to conform to strict `{ html, css, js }` shape and run server-side parse/length validation for all providers.
- Rationale: reduces parser fragility and improves reliability for rendering.
- Alternatives considered:
- Free-form text and regex extraction: too error-prone and brittle.
- HTML-only generation with inferred CSS/JS: lowers flexibility for rich interactions.

### Decision 3: Keep generation synchronous with bounded retries
- Choice: synchronous HTTP endpoints with timeout-aware error handling and single retry path for token-limit truncation when caller did not set hard limits.
- Rationale: aligns with MVP simplicity and existing proven pattern.
- Alternatives considered:
- Queue-based async jobs: more resilient but deferred intentionally per product direction.

### Decision 4: Implement fast-default model routing with optional higher-quality regeneration
- Choice: route initial generation to low-latency model settings and allow regenerate/refine requests to opt into higher-quality settings.
- Rationale: balances user-perceived responsiveness with quality control.
- Alternatives considered:
- Always high-quality model: too slow for initial loop.
- Always fast model: risks weak educational quality for complex prompts.

### Decision 5: Use full regeneration for refinement
- Choice: pass prior generated artifact plus user refinement intent and regenerate a complete replacement payload.
- Rationale: simpler and more reliable than patching generated JS/CSS/HTML deltas.
- Alternatives considered:
- Patch-based diffs: finer control but significantly higher complexity and fragility.

### Decision 6: Enforce sandboxed rendering and minimal safety checks in MVP
- Choice: render only via iframe sandbox (`allow-scripts`), disallow external scripts/network calls by contract, and perform server-side guard checks for disallowed patterns before returning payload.
- Rationale: practical safety baseline with low implementation cost.
- Alternatives considered:
- No guard checks beyond prompt instructions: insufficient risk control.
- Full JS static analyzer/runtime isolation framework: excessive for MVP.

## Risks / Trade-offs

- [LLM output still violates contracts in edge cases] -> Mitigation: strict schema request, robust parser fallback, user-facing regeneration/error UX.
- [Synchronous latency harms user experience] -> Mitigation: clear loading states, timeout messaging, fast default model routing.
- [Generated JS may attempt blocked browser operations] -> Mitigation: iframe sandbox + response scanning for known disallowed patterns + CSP-aligned rendering strategy.
- [Provider API variance causes inconsistent behavior] -> Mitigation: provider abstraction layer and normalized error mapping.
- [Refinement quality drift across repeated edits] -> Mitigation: include prior artifact and original prompt context; expose regenerate control.

## Migration Plan

1. Add backend modules and API contracts behind new `/generate` and `/refine` endpoints.
2. Build frontend create/play/refine screen and integrate with backend APIs.
3. Add iframe sandbox rendering container and local recent-creations storage.
4. Validate with end-to-end MVP flow tests and manual prompt suites.
5. Rollout as MVP baseline in development/staging; no production migration of existing user data required.

Rollback strategy:
- Revert to previous scaffold deployment state (no persistent data migration involved).
- Disable generation endpoints and hide create flow UI behind feature flag if needed.

## Open Questions

- Which exact provider/model pair should be defaulted in production environment variables for launch week?
- What maximum token/output size limits best balance quality vs cost for real prompt distributions?
- Should refinement endpoint expose explicit quality mode toggle or infer from request type?
- What minimal disallowed-pattern list is required before public demo usage?
