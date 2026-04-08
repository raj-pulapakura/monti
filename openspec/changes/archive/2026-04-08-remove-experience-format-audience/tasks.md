## 1. Database

- [x] 1.1 Add Supabase migration to drop `format` and `audience` from `public.experience_versions` (single `ALTER TABLE ... DROP COLUMN` for both).
- [x] 1.2 Update `supabase/schemas/experiences.sql` `experience_versions` definition to remove those columns and their checks.
- [x] 1.3 Refresh `backend/src/supabase/supabase.types.ts` (`experience_versions` Row/Insert/Update) to match the live schema.

## 2. DTO and dead code

- [x] 2.1 Remove `format`, `audience`, `ExperienceFormat`, `AudienceLevel`, `EXPERIENCE_FORMATS`, and `AUDIENCE_LEVELS` from `experience.dto.ts` as appropriate; remove `parseGenerateExperienceRequest` entirely.
- [x] 2.2 Fix any remaining imports of removed types across the backend.

## 3. Persistence and orchestration

- [x] 3.1 Remove `format`/`audience` from `ExperiencePersistenceService` and `ExperiencePersistenceRepository` inputs and Supabase insert payloads.
- [x] 3.2 Remove `format`/`audience` threading from `ExperienceOrchestratorService` (`generate`, `executeGeneration`, persistence calls).

## 4. Chat tool and registry

- [x] 4.1 Remove `format`/`audience` from `GenerateExperienceToolArguments`, parser, and `GenerateExperienceToolService` orchestrator calls.
- [x] 4.2 Remove `format` and `audience` from `chat-tool-registry.service.ts` tool JSON schema for `generate_experience`.

## 5. LLM routing

- [x] 5.1 Remove `format`/`audience` from `LlmRoutingRequest`, `buildRouterUserInput`, and all `selectRoute` / `invokeRouterModel` call sites.
- [x] 5.2 Trim router system prompt examples and policy lines that assume structured audience (keep tier policy coherent with prompt-only inference).

## 6. Tests and smoke

- [x] 6.1 Update unit tests: prompt-builder (fixtures), orchestrator, persistence, generate-experience tool, decision router, and any others referencing removed fields.
- [x] 6.2 Update `backend/test/mvp-smoke.e2e-spec.ts` (and other e2e) payloads.
- [x] 6.3 Run backend unit tests and smoke/e2e as appropriate.

## 7. Optional follow-ups (out of core scope)

- [x] 7.1 Align `openspec/specs/educator-landing-experience/spec.md` marketing language if “format tag” / “audience tag” on example cards is no longer accurate.
