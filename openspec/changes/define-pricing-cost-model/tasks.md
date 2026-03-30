## 1. Research Baseline

- [x] 1.1 Inventory Monti's current provider, model, routing, and persistence inputs that are relevant to pricing, including active default routes, dormant configured alternatives, the successful-run path, and the `assistant_runs` / `tool_invocations` / `generation_runs` / `experience_versions` telemetry surfaces.
- [x] 1.2 Create `docs/pricing/provider-pricing-research.md` with official current pricing sources for OpenAI, Anthropic, and Google Gemini, including retrieval date, source URL, input/output pricing units, and preview/deprecation notes.
- [x] 1.3 Extend `docs/pricing/provider-pricing-research.md` with official model-catalog or deprecation sources whenever a Monti runtime model ID is ambiguous, preview-only, legacy, or retired.
- [x] 1.4 Add a model-to-pricing normalization table to `docs/pricing/provider-pricing-research.md` that maps Monti runtime model IDs and aliases to the pricing SKUs used for estimation, with `exact`, `assumption-based`, or `migration-required` status for each row.

## 2. Cost Estimation Method

- [x] 2.1 Create `docs/pricing/cost-estimation-method.md` that defines the billable successful-run policy, including chargeable outcomes, non-chargeable outcomes, automatic retries, cancellation handling, system-deduplicated replays, intentional repeat user requests, and multiple successful tool invocations inside one assistant run.
- [x] 2.2 Document three cost lenses: artifact-producing cost, successful-request cost, and full monetized-success cost, using actual token counts where available and weighted averages based on observed successful-invocation distribution rather than equal-provider averaging.
- [x] 2.3 Document how the method handles telemetry gaps, including missing `tokens_in` / `tokens_out`, absent router or conversation token counts, alias ambiguity, retired-model mappings, preview-model pricing volatility, and whether provider usage exports are required.
- [x] 2.4 Record the named observation window, active runtime config snapshot, segment sample sizes, and estimate confidence level (`observed`, `mixed`, or `assumption-heavy`) used by the method.

## 3. Pricing Decision Pack

- [x] 3.1 Create `docs/pricing/plan-recommendation.md` with a recommended free allowance, paid monthly allowance, `fast` / `quality` credit weights, top-up policy, and explicit rationale for whether overhead and non-billable leakage are absorbed in credit weights, plan margin, or a hybrid approach.
- [x] 3.2 Add unit-economics sanity checks and sensitivity scenarios to `docs/pricing/plan-recommendation.md`, including at minimum quality-mix sensitivity, routing-mix change, non-billable failure leakage, and observed-versus-estimated cost caveats.
- [x] 3.3 Review the three pricing markdown deliverables for consistency, capture remaining stakeholder questions, and list the follow-on billing/product/runtime changes needed after this planning phase, including model-config migrations and telemetry instrumentation.
