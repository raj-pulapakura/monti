## Why

Structured `format` and `audience` selectors are no longer passed into the primary generation prompt (experiments showed better outputs without them). Carrying them in the API, tool contract, router input, and database creates false precision and maintenance cost. Removing them aligns the product contract with what the model actually uses.

## What Changes

- **BREAKING**: `GenerateExperienceRequest` and `generate_experience` tool arguments no longer include `format` or `audience`.
- **BREAKING**: `public.experience_versions` drops `format` and `audience` columns (new migration); no backward compatibility for old clients or segmentation on those fields.
- Router and persistence layers stop reading or writing those fields; router infers tier from prompt and execution context only.
- Remove unused `parseGenerateExperienceRequest` and related DTO parsing for removed fields (dead code today—no callers in-repo).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `experience-persistence`: Version rows and schema no longer store `format` or `audience`.
- `experience-generation`: Generation intent contract is prompt (+ conversation context) only; no structured format/audience selectors.
- `llm-routing-decision`: Routing input contract no longer includes tool-supplied `format`/`audience` lines.
- `native-provider-tool-calling`: `generate_experience` tool schema exposed to the model omits `format` and `audience` parameters.

## Impact

- **Backend**: `experience.dto.ts`, orchestrator, persistence service/repository, generate-experience tool types/service, chat tool registry JSON schema, LLM decision router request builder and system-prompt examples, all related unit/e2e tests.
- **Database**: New Supabase migration; update declarative `supabase/schemas/experiences.sql`; regenerate or hand-edit `backend/src/supabase/supabase.types.ts`.
- **Web**: No API types dependency found for these fields on main paths; marketing copy mentioning “format” as a user-facing picker may need a separate copy pass (out of scope unless listed in tasks).
