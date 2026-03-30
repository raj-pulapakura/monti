## Context

Monti's current runtime exposes several distinct pricing surfaces rather than one unified cost stream:

- `backend/src/llm/llm-config.service.ts` currently routes both generation tiers to Gemini by default: `fast -> gemini-3.1-flash-lite-preview` and `quality -> gemini-3.1-pro-preview`. The router model is separately configured as OpenAI `gpt-5-mini`, and the fixed conversation model is separately configured as OpenAI `gpt-5.4`. Anthropic models are configured as alternatives, but they are not active default routes under the current config.
- A successful generation/refinement flow is mediated through `generate_experience` and the experience orchestrator in `backend/src/chat-runtime/tools/generate-experience-tool.service.ts` and `backend/src/experience/services/experience-orchestrator.service.ts`.
- A single assistant run can contain multiple tool rounds. `assistant_runs` captures conversation-loop lifecycle, `tool_invocations` captures each `generate_experience` execution and its selected route, `generation_runs` captures generation request lifecycle, and `experience_versions` records only successful persisted artifact outcomes. Pricing analysis therefore cannot use thread count or assistant-run count as a proxy for billable successful runs.
- The full-run telemetry surface spans both `supabase/schemas/experiences.sql` and `supabase/migrations/20260315000500_decouple_conversation_generation.sql`, because the migration adds conversation-provider and tool-to-generation correlation fields used by the chat runtime.
- The schema includes `tokens_in` / `tokens_out` columns on `experience_versions`, but the current persistence path does not populate them. The generation providers currently return structured text only, and the conversation loop stores raw request/response envelopes without a normalized token ledger. Today, token-based cost analysis is therefore only partially observed unless separate provider usage exports are available.

Current official pricing research inputs, retrieved on 2026-03-30 from official provider docs, further show why normalization and evidence discipline are required:

- OpenAI's official API pricing page lists `GPT-5.4` at `$2.50 / 1M input tokens` and `$15.00 / 1M output tokens`, and `GPT-5.4 mini` at `$0.75 / 1M input tokens` and `$4.50 / 1M output tokens`. OpenAI's official model docs also list `gpt-5-mini` as its own current model with lower pricing, so Monti's configured `gpt-5-mini` cannot be silently normalized to `GPT-5.4 mini` by name similarity alone.
- Anthropic's official model overview and model-deprecation docs center Claude 4.6 / Haiku 4.5 as current models and show Claude Sonnet 3.5 models as retired on October 28, 2025. Monti currently references `claude-3-5-sonnet-latest`, so any Anthropic estimate must be flagged as migration-required or mapped to a replacement explicitly.
- Google's official Gemini pricing and model docs list `gemini-3.1-pro-preview` and `gemini-3.1-flash-lite-preview` as preview models with prompt-length-dependent pricing and separate grounding charges. Those are Monti's current default generation models, so preview volatility and applicable prompt brackets must be recorded explicitly.

This change is intentionally planning-only. Its implementation outputs are markdown documents, not runtime changes.

## Goals / Non-Goals

**Goals:**

- Produce a decision-ready pricing documentation set for Monti's per-successful-run monetization model.
- Define the exact billable successful-run policy, including inclusions, exclusions, and retry/dedup behavior.
- Define a repeatable provider pricing research workflow that uses official sources only and records retrieval date, SKU mapping, and pricing volatility notes.
- Define a cost-estimation method that combines Monti's observed run metadata with official provider token pricing and explicitly separates observed from assumed components.
- Produce a pricing recommendation pack that turns the cost model into actionable plan numbers and follow-on implementation requirements.

**Non-Goals:**

- Implementing checkout, subscriptions, entitlements, credit ledgers, or paywall UI.
- Changing runtime routing, persistence behavior, or telemetry capture in this change.
- Finalizing legal, tax, invoicing, or finance operations policy.
- Locking the production pricing page copy or billing UX.

## Decisions

### 1. This is a planning-only change with markdown deliverables

Implementation for this change will produce documentation under `docs/pricing/` and no product code. The goal is to remove ambiguity and provide a strong base for a later billing implementation change.

The planned markdown deliverables are:

- `docs/pricing/provider-pricing-research.md`
- `docs/pricing/cost-estimation-method.md`
- `docs/pricing/plan-recommendation.md`

Alternative considered:

- Build billing scaffolding first and refine the economics later.

Why rejected:

- It would force product and engineering decisions before the cost model is trustworthy.

### 2. Billable unit is a successful generate/refine run, not a thread or session

The pricing model will be anchored on a successful `generate_experience` execution that results in a persisted experience version or equivalent success state in the core generation flow. A conversation run, thread, or user session is never the billable unit. This matches the user's chosen direction and aligns cleanly with Monti's current generation/refinement architecture.

The policy documents must explicitly classify these outcomes:

- Billable: successful generate, successful refine.
- Non-billable: provider failure, timeout, refusal, safety rejection, validation rejection, canceled flow, system-deduplicated idempotent replay that reuses an already-counted result, and any failed retry chain that never reaches success.
- Still billable: a new successful invocation triggered by a genuine repeat user action, even if the prompt resembles a prior request.
- Explicitly classified: if one assistant run produces multiple successful `generate_experience` invocations, each success is either counted separately or excluded only by a documented system-side dedup rule tied to the persisted artifact.

Alternatives considered:

- One credit per experience/thread.
- Unlimited plans without usage controls.
- Pure token-based charging.

Why rejected:

- Thread-level pricing obscures the actual cost driver.
- Unlimited is margin-risky before usage distribution is known.
- Raw token pricing exposes too much provider complexity to end users.

### 3. Provider pricing research must use official sources and a normalization table

The pricing research document will be the source of truth for all cost estimates. It must:

- use official provider pricing pages for rates, plus official model catalog, migration, or deprecation documentation whenever a runtime model ID is ambiguous, preview-only, legacy, or retired;
- record retrieval date and source URL;
- capture input, output, cached-input, and other relevant billing dimensions when they could affect Monti later;
- map Monti runtime model IDs and aliases to the billable pricing SKU actually used for estimation;
- record whether each mapping is exact, assumption-based, or migration-required;
- flag preview, deprecated, retired, or ambiguous SKUs explicitly;
- default to standard self-serve API list pricing unless a different billing basis is explicitly chosen and justified.

This normalization step is required because current runtime labels and pricing page labels differ, for example:

- `gpt-5-mini` in code vs `GPT-5.4 mini` on OpenAI pricing pages, even though OpenAI's official model docs list `gpt-5-mini` as a separate current model;
- `claude-3-5-sonnet-latest` in code vs Anthropic's active Claude 4.6 / Haiku 4.5 lineup and retired Sonnet 3.5 family;
- preview Gemini model IDs with tier-dependent pricing.

Alternative considered:

- Directly match persisted `model` strings to provider pricing tables.

Why rejected:

- It is brittle and will misprice runs when aliases, preview SKUs, or renamed model families are involved.

### 4. The cost model will produce three lenses: artifact-producing cost, successful-request cost, and full monetized-success cost

The documents will define three separate cost views:

- **Artifact-producing cost**: the cost of the provider/model call that produced the successful persisted artifact.
- **Successful-request cost**: artifact-producing cost plus any generation-side retries or additional provider calls attributable to the same successful request when that evidence is available.
- **Full monetized-success cost**: successful-request cost plus router/conversation overhead and an allocated share of non-billable but cost-incurring traffic from the same observation window.

Artifact-producing cost is the lower bound. Successful-request cost protects against undercounting automatic retries inside a billable success. Full monetized-success cost is the margin lens that matters for packaging and guardrails, but it must only include overhead and leakage components that are observed or clearly estimated.

Alternative considered:

- Publish a single blended cost number.

Why rejected:

- It would hide which parts of the estimate are observed versus assumed, which is risky while telemetry is incomplete.

### 5. Weighted averages must follow observed run distribution, not equal-provider averaging

The pricing method will calculate average cost from Monti's actual successful-invocation mix over a named observation window, at minimum segmented by:

- operation: `generate` vs `refine`
- quality mode: `fast` vs `quality`
- provider/model path when sample size is meaningful

The method will record sample sizes and the active runtime config snapshot for that window, and it will not use a naive provider-average that gives OpenAI, Anthropic, and Gemini equal weight regardless of how often Monti actually routes to them.

Alternative considered:

- Simple arithmetic average across provider list prices.

Why rejected:

- It would not represent real product cost if one provider dominates actual routing.

### 6. Missing telemetry must be documented, not silently imputed

The cost-estimation method must include a telemetry sufficiency section that states:

- which inputs are already observed in storage;
- which cost components are currently unavailable;
- what fallback evidence is used to bridge the gap;
- the fallback order used when first-party telemetry is missing;
- how much those assumptions could change the recommended plan.

Given the current code path, the documents should assume that `tokens_in` / `tokens_out` require validation before they can support a fully observed estimate, and that raw provider traces are useful for spot checks but are not yet a canonical token ledger. The fallback order should prefer observed persisted telemetry, then provider-side usage exports if available, then clearly bounded assumptions.

Alternative considered:

- Fill gaps with hidden assumptions and present a single confident number.

Why rejected:

- It would make later pricing revisions harder to explain and easier to misinterpret.

### 7. The final output is a pricing decision pack, not raw research only

The implementation deliverables must end with explicit recommendations:

- free allowance
- paid monthly allowance
- `fast` and `quality` credit weights
- top-up policy
- rollover policy recommendation
- margin sanity checks
- whether overhead and non-billable leakage are absorbed into credit weights, plan margin, or a documented hybrid approach
- confidence rating and refresh triggers for the recommendation
- follow-on implementation change list

Alternative considered:

- Stop at research notes and let a later discussion translate them into pricing.

Why rejected:

- The point of this change is to turn research into a decision-ready pricing strategy.

### 8. Every estimate must be reproducible from a named evidence set

Each pricing document must tie its outputs back to a concrete evidence set that includes:

- provider pricing retrieval date and source links;
- observation window date range;
- active runtime config snapshot for router, conversation, and generation model paths;
- sample sizes used for weighting;
- confidence classification such as `observed`, `mixed`, or `assumption-heavy`.

Alternative considered:

- Allow each document to choose its own implicit timeframe and assumptions.

Why rejected:

- It would make later pricing debates impossible to reconcile because the same "average cost" could be derived from different windows, configs, or assumption sets.

## Risks / Trade-offs

- [Current token telemetry may be incomplete] -> Separate observed cost from estimated cost, document the gap explicitly, and treat any final pricing number as provisional until telemetry sufficiency is verified.
- [Provider model aliases may not map cleanly to current pricing tables] -> Maintain a normalization table with source links and unresolved ambiguity flags.
- [Preview model pricing can change quickly] -> Record retrieval date, preview status, and a refresh requirement before billing implementation begins.
- [Observed routing mix may change after product or model configuration changes] -> Tie the cost analysis to a named observation window and runtime config snapshot.
- [Current default generation routes are Gemini-only even though multiple providers are configured] -> Separate active default routes from dormant alternatives so the analysis does not imply a diversified provider mix that the runtime is not currently using.
- [One assistant run can contain multiple tool invocations] -> Define billing at the successful tool-invocation boundary and test the edge cases explicitly in the policy doc.
- [Direct generation cost may understate true margin impact] -> Produce separate artifact, successful-request, and full monetized-success lenses instead of collapsing them into one number without evidence.

## Migration Plan

No runtime migration is required in this change.

Implementation for this change will:

1. create the pricing research and recommendation markdown files;
2. review them with stakeholders;
3. use them as prerequisites for a later billing/entitlements implementation change.

Rollback is trivial because this phase is documentation-only.

## Open Questions

- If provider-side usage exports are not available for historical backfill, who approves the assumption-heavy fallback methodology for the first decision pack?
- What minimum contribution-margin floor should the launch recommendation optimize for?
