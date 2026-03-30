## 1. Schema And Contract Foundations

- [x] 1.1 Add the telemetry storage fields needed for request-level generation usage, assistant-run conversation usage, and per-invocation router telemetry in a new Supabase migration.
- [x] 1.2 Update `supabase/schemas/experiences.sql` so the declarative schema matches the telemetry migration shape, including the already-decoupled conversation/tool columns that are currently missing from the snapshot.
- [x] 1.3 Regenerate or update `backend/src/supabase/supabase.types.ts` for the new usage telemetry fields.
- [x] 1.4 Extend the shared LLM contracts so generation providers, router execution, and native tool-calling turns can all return canonical observed-or-unavailable usage telemetry.

## 2. Provider And Router Normalization

- [x] 2.1 Update the generation provider adapters in `backend/src/llm/providers/` to parse provider usage and return canonical generation usage telemetry.
- [x] 2.2 Update the native provider tool adapters in `backend/src/llm/tool-runtime/providers/` to parse provider usage and return canonical conversation-turn usage telemetry.
- [x] 2.3 Update `LlmDecisionRouterService` to capture router request/response telemetry and canonical router usage for routing calls.
- [x] 2.4 Add or update backend tests that verify observed and unavailable usage normalization for OpenAI, Anthropic, and Gemini surfaces.

## 3. Runtime Aggregation And Persistence

- [x] 3.1 Thread tool-invocation correlation through the `generate_experience` execution path so router telemetry can be persisted on the correct invocation record.
- [x] 3.2 Accumulate generation attempt usage in `ExperienceOrchestratorService` and persist request-level totals plus `attempt_count` on `generation_runs` only when the full request boundary is observed.
- [x] 3.3 Persist successful artifact-producing token usage on `experience_versions` without substituting estimated counts when provider usage is unavailable.
- [x] 3.4 Aggregate conversation-model usage across completed assistant-run rounds in `ConversationLoopService` and persist totals on `assistant_runs` only when the full run boundary is observed.
- [x] 3.5 Persist router provider/model, router request/response traces, router decision context, and observed router usage on `tool_invocations`.
- [x] 3.6 Add or update repository and service tests for successful, failed, retrying, and usage-unavailable persistence cases.

## 4. Documentation And Verification

- [x] 4.1 Update the pricing markdown docs in `docs/pricing/` so they describe the new observed usage fields, the retry-aware request totals, and any remaining telemetry gaps accurately.
- [x] 4.2 Run the relevant backend test suites covering LLM adapters, router decisions, conversation loops, orchestrator persistence, and Supabase-facing repositories.
