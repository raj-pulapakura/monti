## Context

Monti's monetization roadmap now depends on observed cost telemetry rather than planning-only estimates, but the current runtime drops or inconsistently stores usage at each major LLM boundary.

Current state:

- generation providers return only `{ provider, model, rawText }`, so generation usage is lost before orchestration or persistence;
- `experience_versions` already has `tokens_in` and `tokens_out`, but persistence never writes them;
- `generation_runs` records lifecycle state only, with no retry-aware token totals or attempt count;
- `assistant_runs` stores raw conversation provider envelopes, but those envelopes are overwritten each loop round and usage is not normalized into queryable fields;
- router decisions persist selected generation tier/provider/model, but the router model's own request/response and usage are discarded; and
- the declarative Supabase schema snapshot has drifted behind the migrations for some chat-runtime telemetry columns.

This change is the first implementation-facing monetization proposal. Its job is to make internal cost measurement real before billing primitives, credits, or Stripe flows depend on it.

## Goals / Non-Goals

**Goals:**

- Introduce one canonical usage-telemetry contract that generation providers, router execution, and native provider tool-calling can all emit.
- Persist observed generation request totals and retry count at the request boundary.
- Persist observed artifact-producing token counts on successful `experience_versions`.
- Persist observed conversation-model usage totals at the assistant-run boundary across multi-round tool loops.
- Persist router-model request/response telemetry and router usage at the `generate_experience` execution boundary.
- Keep missing usage explicit rather than inferred so later pricing logic can distinguish observed from estimated cost.
- Bring migrations, declarative schema snapshots, generated Supabase types, and backend tests back into sync around telemetry storage.

**Non-Goals:**

- Implementing credits, billing ledgers, Stripe, or runtime billing enforcement.
- Estimating token usage from character counts or pricing heuristics inside the runtime.
- Building per-attempt or per-round event tables in this change.
- Reworking public pricing or authenticated billing UI.
- Solving every historical schema drift issue unrelated to usage telemetry.

## Decisions

### 1. Introduce a canonical observed-or-unavailable usage contract

Every provider-backed LLM boundary in scope will emit a canonical usage object with:

- input-token count when observed;
- output-token count when observed;
- total-token count when observed or derivable;
- availability state (`observed` or `unavailable`); and
- a provider-specific raw usage snippet when available.

This contract will be added to:

- generation provider results;
- router execution results; and
- canonical native tool-turn responses.

Why this choice:

- Later persistence and analytics logic need one consistent shape regardless of provider.
- Availability must be explicit so missing usage is not confused with zero usage.
- Provider-specific raw usage can still be retained without leaking provider-native formats through the rest of the runtime.

Alternatives considered:

- Keep provider-specific usage shapes end to end: rejected because it spreads provider branching throughout orchestration and persistence.
- Persist only raw provider responses and parse later: rejected because queryable telemetry would remain expensive and inconsistent.

### 2. Persist usage at the boundary that actually owns the cost

Telemetry will be stored at four different runtime boundaries:

- `experience_versions.tokens_in` / `tokens_out`: the successful artifact-producing attempt only;
- `generation_runs.request_tokens_in` / `request_tokens_out` plus `attempt_count`: the whole generate/refine request, aggregated across retries when fully observed;
- `assistant_runs.conversation_tokens_in` / `conversation_tokens_out`: the whole assistant run, aggregated across completed conversation rounds when fully observed; and
- `tool_invocations.router_*`: router provider/model, router request/response traces, and router token usage for the specific `generate_experience` execution that invoked routing.

Why this choice:

- Different monetization questions map to different boundaries.
- Artifact cost, request cost, and conversation overhead should not be merged into one opaque counter.
- Router usage belongs to the tool invocation, not the whole assistant run, because one assistant run can include multiple generation tool executions.

Alternatives considered:

- Store everything on `assistant_runs`: rejected because router and generation execution can happen multiple times within one assistant run.
- Store router usage on `generation_runs`: rejected because the current code creates the generation request id inside orchestration, after route selection.
- Store only `experience_versions` token counts: rejected because retries and failed requests would remain invisible.

### 3. Aggregate retries and multi-round runs only when the full boundary is observed

Request-level and run-level totals will be treated as complete-boundary measurements, not partial sums.

That means:

- `generation_runs.request_tokens_in` / `request_tokens_out` are persisted only when every generation attempt in that request produced observed usage;
- `assistant_runs.conversation_tokens_in` / `conversation_tokens_out` are persisted only when every completed conversation round in that run produced observed usage; and
- if any contributing attempt or round lacks usage, the aggregate total remains null rather than storing a partial undercount.

`experience_versions.tokens_in` / `tokens_out` are exempt from this rule because they represent one successful artifact-producing attempt rather than an aggregate boundary.

Why this choice:

- Partial totals look precise but silently undercount real cost.
- Later pricing logic can treat null aggregate totals as "estimate required" without guessing whether a value is complete.
- This avoids introducing extra status columns solely to explain partial aggregation.

Alternatives considered:

- Persist partial totals with a status flag: rejected for now because it expands schema and analytics complexity before there is evidence it is needed.
- Estimate missing attempt/round usage from prompt length: rejected because runtime telemetry must not fabricate costs.

### 4. Keep generation retry accounting lightweight with `attempt_count`, not a new attempts table

The orchestrator will accumulate per-attempt usage in memory and persist:

- `attempt_count` on `generation_runs`; and
- aggregate request totals only when every attempt is observed.

No separate `generation_attempts` table will be added in this change.

Why this choice:

- Billing-grade measurement mainly needs total observed request cost and retry count.
- The current runtime retries at most once, so a full attempt event model would be more overhead than value right now.
- A later ops or analytics phase can still add attempt-level storage if real requirements appear.

Alternatives considered:

- Add a `generation_attempts` table now: rejected as premature scope expansion.

### 5. Correlate router telemetry to tool invocations by threading invocation context deeper

`generate_experience` routing occurs after the tool invocation record exists but before generation orchestration creates its own request id. To keep router telemetry at the right boundary, the implementation will thread tool invocation context into the generate-experience execution path so router traces and usage can be stored on `tool_invocations`.

Why this choice:

- The router cost belongs to the specific tool execution that requested generation.
- It avoids redefining generation request identity earlier in the stack just to support router persistence.

Alternatives considered:

- Pre-generate generation request ids in the tool service and move router telemetry to `generation_runs`: rejected because it makes request identity and orchestration more tightly coupled than needed for this phase.

### 6. Keep conversation raw envelopes as best-effort traces, and add normalized totals for querying

The existing `assistant_runs.provider_request_raw` and `provider_response_raw` fields will remain as best-effort raw traces for the latest completed round recorded by the loop. This change will not introduce a per-round raw trace table.

Instead, the conversation loop will add normalized aggregate token totals on `assistant_runs` so cost queries no longer depend on parsing raw provider envelopes.

Why this choice:

- Raw trace overwriting is not ideal, but it is a separate observability problem from cost measurement.
- Normalized aggregate totals solve the actual monetization dependency with far less scope.

Alternatives considered:

- Add a per-round assistant-run events table: rejected as too large for the first telemetry implementation.

### 7. Treat schema synchronization as part of the change, not cleanup later

This proposal will update:

- new migration(s);
- `supabase/schemas/experiences.sql`; and
- `backend/src/supabase/supabase.types.ts`

as part of the same implementation.

Why this choice:

- Telemetry changes are storage-heavy; leaving migration and snapshot drift unresolved would make the next billing proposals less trustworthy.

Alternatives considered:

- Update only migrations and defer schema snapshot/types: rejected because the repo already shows drift in telemetry-related tables.

## Risks / Trade-offs

- [Some provider surfaces may not expose usage in the exact same way] -> Normalize to observed-or-unavailable and keep provider-specific raw usage snippets for debugging.
- [Aggregate totals may remain null more often than desired if any attempt/round is missing usage] -> Prefer explicit incompleteness over silent undercounting; revisit partial aggregation only if it blocks analysis in practice.
- [Threading invocation context deeper into generate-experience execution increases coupling] -> Limit the new correlation data to telemetry persistence only and keep the broader tool contract unchanged.
- [Conversation raw traces still overwrite by round] -> Use normalized aggregate columns for cost analytics and defer per-round trace storage to a later observability-focused change if needed.
- [Schema drift can reappear if migrations, snapshots, and generated types are updated separately] -> Make synchronized schema updates and tests part of the required implementation tasks.

## Migration Plan

1. Add the telemetry schema changes in a migration, including request-level generation usage fields, assistant-run conversation usage fields, and router telemetry fields on tool invocations.
2. Update `supabase/schemas/experiences.sql` and generated Supabase types to reflect the new storage shape and the existing decoupled conversation-generation columns.
3. Extend generation providers, native provider tool adapters, and router execution to emit canonical usage telemetry.
4. Thread the new telemetry objects through orchestration and persistence, including retry aggregation and tool-invocation router correlation.
5. Add or update backend tests for provider normalization, persistence writes, retry aggregation, and unavailable-usage behavior.
6. Update pricing docs to replace "usage missing" statements with the new observed-storage behavior and any remaining gaps.

Rollback strategy:

- leave new columns nullable so old runtime behavior can continue if the telemetry code is reverted;
- revert runtime writes while keeping schema additions in place if deployment must be rolled back quickly; and
- treat any partially deployed rows with null telemetry as unavailable rather than invalid.

## Open Questions

- Do we want to persist compact generation raw usage JSON on `generation_runs` in this phase, or are normalized counts plus existing output summary sufficient for the first implementation?
- Is aggregated conversation usage on `assistant_runs` enough for the next billing phases, or will ops quickly need per-round assistant-run trace storage as well?
