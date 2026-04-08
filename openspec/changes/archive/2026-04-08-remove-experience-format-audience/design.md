## Context

Generation prompts already omit audience- and format-specific guidance; experiments showed higher quality. The codebase still threads `format` and `audience` through DTOs, the `generate_experience` tool, the LLM routing request, and `experience_versions` in Postgres. `parseGenerateExperienceRequest` is exported but unused. The user approved dropping columns without backward compatibility and removing dead code.

## Goals / Non-Goals

**Goals:**

- Single contract: generation is driven by natural-language prompt (and optional conversation context), not structured format/audience fields.
- Database matches contract: no `format`/`audience` columns on `experience_versions`.
- Router and tool surface aligned: no ghost parameters the model can set.
- Delete unused request parser for generate bodies.

**Non-Goals:**

- Re-deriving or backfilling historical format/audience for old rows (columns dropped).
- Changing landing/marketing copy unless explicitly pulled into scope.
- Changing JWT `audience` or unrelated uses of the word “format” in providers.

## Decisions

1. **Drop columns vs. stop writing** — **Drop** `format` and `audience` on `public.experience_versions` in a new migration. Rationale: user explicitly does not need segmentation or compatibility; nullable columns would still imply a feature that no longer exists.

2. **Remove DTO types** — Remove `ExperienceFormat`, `AudienceLevel`, and the `EXPERIENCE_FORMATS` / `AUDIENCE_LEVELS` constants from `experience.dto.ts` if nothing else needs them after the sweep. Rationale: one less parallel enum world; any future “preset” belongs in prompt text or a separate experiment.

3. **Remove `parseGenerateExperienceRequest`** — Delete the function entirely. Rationale: confirmed zero call sites; user green-lit dead-code removal. If a REST generate endpoint appears later, add parsing next to that controller.

4. **Router** — Remove `format` and `audience` from `LlmRoutingRequest` and from `buildRouterUserInput`; trim system-prompt examples that mention audience for routing. Rationale: routing infers from prompt; avoids stale signals.

5. **TypeScript DB types** — Update `backend/src/supabase/supabase.types.ts` to match migrated schema (regenerate via Supabase CLI if that is the team norm, else edit the `experience_versions` Row/Insert shapes).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Deploy order: old backend writes columns after migration | Deploy migration and backend in same release window; migration runs first in pipeline. |
| External client still sends `format`/`audience` | **BREAKING** by design; JSON parse can ignore unknown keys if parser allows, or fail fast—prefer explicit validation that rejects unknown top-level keys only if you already do that elsewhere. |
| Tests/fixtures still pass removed fields | Grep and update all specs and e2e payloads. |

## Migration Plan

1. Add `supabase/migrations/<timestamp>_drop_experience_versions_format_audience.sql`: `alter table public.experience_versions drop column if exists format, drop column if exists audience;`
2. Update `supabase/schemas/experiences.sql` to remove those columns from the `experience_versions` definition.
3. Deploy DB migration, then backend that no longer references columns.

Rollback: restore columns via new migration (without CHECK constraints matching old enums) only if absolutely needed; user has waived compatibility.

## Open Questions

- None blocking implementation; marketing/educator specs that mention “format tag” on landing are product copy, not API contract.
