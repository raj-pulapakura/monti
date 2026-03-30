# Cost Estimation Method

Last updated: 2026-03-30

## Objective

This method defines how Monti estimates three separate lenses of cost:

1. artifact-producing cost
2. successful-request cost
3. full monetized-success cost

The method is intentionally explicit about what is observed versus estimated. Today's telemetry is good enough for a planning recommendation, but not good enough for a production billing launch without follow-on instrumentation.

## Evidence Set

### Observation window

- Window name: `2026-03-29 initial successful-run snapshot`
- Start: 2026-03-29T10:20:00.547671Z
- End: 2026-03-29T10:22:46.893770Z

### Active runtime config snapshot

| Surface | Value used for this method |
| --- | --- |
| Conversation provider/model | `openai / gpt-5.4` |
| Router provider/model | `openai / gpt-5-mini` |
| Default generation `fast` route | `gemini / gemini-3.1-flash-lite-preview` |
| Default generation `quality` route | `gemini / gemini-3.1-pro-preview` |
| Conversation max tool rounds | `4` |
| Default generation max tokens | `32768` |
| Retry max tokens | `32768` |

### Sample sizes used by the method

| Segment | Sample size |
| --- | --- |
| `assistant_runs` total | 1 |
| `assistant_runs` succeeded | 1 |
| `tool_invocations` for `generate_experience` succeeded | 1 |
| `tool_invocations` for `generate_experience` failed | 0 |
| `generation_runs` succeeded | 1 |
| `generation_runs` failed | 0 |
| `experience_versions` persisted | 1 |
| `generate` operations | 1 |
| `refine` operations | 0 |
| `quality` tier successes | 1 |
| `fast` tier successes | 0 |

### Confidence classification

- Overall estimate confidence: `assumption-heavy`
- Reason:
  - generation token counts are not persisted;
  - router token usage is not normalized into a dedicated ledger;
  - automatic retry attempts are not separately observable;
  - the weighting basis is one observed success, not a representative production distribution.

## Billable Successful-Run Policy

Monti's billable unit is a successful `generate_experience` invocation that produces a persisted `experience_version` or an equivalent successful artifact outcome. The billable boundary is therefore the successful tool invocation, not the chat thread and not the assistant run.

### Outcome classification

| Outcome | Billable? | Treatment |
| --- | --- | --- |
| `generate_experience` succeeds and writes a new `experience_version` | Yes | Count one successful run. |
| `refine` succeeds and writes a new `experience_version` | Yes | Count one successful run. |
| Assistant conversation ends with text only and no tool success | No | Conversation overhead is real cost but not a billable success. |
| Provider failure, timeout, refusal, safety rejection, validation rejection, or persistence failure | No | Costs contribute to non-billable leakage. |
| Assistant run cancelled before a persisted success | No | Non-billable leakage if provider work already occurred. |
| Automatic retry inside one generation request eventually succeeds | One billable success | Retry cost belongs to the same successful-request boundary, not to a separate billable event. |
| Automatic retry chain never reaches success | No | Entire chain is leakage. |
| System-deduplicated replay of the same user message via idempotency key | No additional billable event | `chat_submit_user_message` can return an existing run when the same idempotency key is reused. That replay should not consume new credits. |
| User intentionally repeats a request and Monti creates a new run and a new persisted artifact | Yes | A new successful artifact outcome is a new billable event, even if the prompt resembles a prior request. |
| One assistant run produces multiple successful `generate_experience` invocations | Yes, one per distinct persisted success | Count each distinct `experience_version_id` unless a future system-side dedup rule explicitly reuses an already-counted artifact. |

## Cost Lenses

### 1. Artifact-producing cost

Definition:

The provider-model call that produced the persisted artifact, priced using the normalized provider SKU and the best available token evidence for that call.

Formula:

`artifact_cost = (input_tokens * input_rate) + (output_tokens * output_rate) + other_model_specific_charges`

Use:

- lower-bound unit cost;
- provider/model comparison;
- weighting by successful artifact mix.

### 2. Successful-request cost

Definition:

Artifact-producing cost plus any additional provider cost that belongs to the same successful request boundary, such as automatic retries or multiple generation-side calls that were necessary before the final success.

Formula:

`successful_request_cost = artifact_cost + retry_chain_cost + generation_side_extra_calls`

Use:

- protects against undercounting when one successful request required extra generation work;
- still excludes conversation/router overhead that is outside the generation request boundary.

### 3. Full monetized-success cost

Definition:

Successful-request cost plus the fixed orchestration overhead and an allocated share of non-billable leakage from the same observation window.

Formula:

`full_monetized_success_cost = successful_request_cost + conversation_overhead + router_overhead + allocated_leakage`

Use:

- packaging and credit-weight design;
- plan-margin sanity checks;
- deciding how much preview volatility and failure leakage must be absorbed before billing launch.

## Current Planning Anchors

### Observed token evidence

What is actually observed today:

- `assistant_runs.provider_response_raw.usage` for the single observed conversation run shows:
  - input tokens: `757`
  - output tokens: `132`
- `experience_versions.tokens_in` and `experience_versions.tokens_out` are present in schema but null in the observed success.
- Generation provider contracts currently return only `{ provider, model, rawText }`, so generation usage is dropped before persistence.

### Fallback generation-token assumption

Because generation token usage is not persisted, this method uses a deterministic proxy for the current planning pass:

- observed successful source prompt length: `895` chars;
- prompt builder output for the same request shape: `3542` chars;
- persisted artifact payload size: `11572` chars across `title`, `description`, `html`, `css`, and `js`;
- planning proxy:
  - generation input tokens: `~900`
  - generation output tokens: `~3000`

This proxy is not a substitute for provider usage telemetry. It is only the current fallback for a planning recommendation.

### Cost anchor table

Rates below assume the current active Gemini routes and the under-200k prompt bracket for `gemini-3.1-pro-preview`.

| Lens | Fast (`gemini-3.1-flash-lite-preview`) | Quality (`gemini-3.1-pro-preview`) | Basis |
| --- | --- | --- | --- |
| Artifact-producing cost | `$0.004725` | `$0.037800` | 900 input + 3000 output token proxy |
| Conversation overhead | `$0.0038725` | `$0.0038725` | Observed `gpt-5.4` conversation usage: 757 input + 132 output |
| Successful-request cost | `$0.004725` today | `$0.037800` today | No retry attempts observed; same as artifact cost for current planning sample |
| Full monetized-success cost | `$0.009887` | `$0.047923` | Artifact/successful-request cost + observed conversation overhead + 15% leakage factor |

Why the `quality` credit weight should not be a raw `8x` multiple:

- generation list pricing is an `8x` spread between active Gemini fast and quality routes for the same token volume;
- full monetized-success cost falls to roughly `4.85x` because conversation overhead is fixed and applies to both tiers.

## Weighting Rules

Monti must never average providers equally just because multiple providers are configured. Weighted averages must follow observed successful-invocation distribution.

### Required weighting dimensions

- operation: `generate` vs `refine`
- tier: `fast` vs `quality`
- selected provider/model path when sample size is meaningful

### Current weighting basis

For the live observation window available today:

- `100%` of observed successful invocations are `generate`
- `100%` of observed successful invocations are `quality`
- `100%` of observed successful invocations are `gemini / gemini-3.1-pro-preview`

That means the current weighted average is descriptive for the single observed run only. It is not enough to set final launch pricing without keeping the final recommendation conservative.

## Telemetry Gaps And Fallback Order

### Current gaps

| Gap | Evidence | Impact |
| --- | --- | --- |
| `experience_versions.tokens_in` / `tokens_out` are not populated | Live row is null; persistence repository does not write them | Artifact-producing cost is estimated, not observed |
| Generation provider contract omits usage | `LlmProviderResult` only includes `provider`, `model`, `rawText` | No first-party generation token ledger |
| Router token usage is not persisted | Router call happens in `LlmDecisionRouterService`, but no normalized usage write follows | Auto-mode full-cost estimates miss a small but real component |
| Automatic retry attempts are not logged separately | Orchestrator retries max-token failures inside one request boundary | Successful-request cost can undercount retry chains |
| No observed failures in the current window | Live sample has zero failed tool invocations and zero failed generation runs | Leakage factor is provisional and assumption-based |
| Preview-model volatility | Active Gemini routes are both preview models | Rates can change before billing launch |
| Anthropic alias ambiguity | Configured alias is retired | Anthropic sensitivity must use a replacement mapping, not the configured alias directly |

### Fallback order

When estimating a successful run, use the first available source in this order:

1. observed generation token counts persisted on the successful artifact
2. observed provider usage exports or retained provider-side usage traces
3. deterministic proxy from current prompt-builder output length and persisted artifact size
4. conservative scenario bands if even the proxy is unavailable

For conversation overhead:

1. observed `assistant_runs.provider_response_raw.usage`
2. provider export or trace reconstruction
3. conservative fixed overhead assumption by conversation model

Provider usage exports are not required to produce a provisional pricing recommendation, but they are required if Monti wants to upgrade the estimate from `assumption-heavy` to `mixed` or `observed`.

## Handling Specific Edge Cases

### Missing token fields

- Do not silently fill null `tokens_in` / `tokens_out` with invented values.
- If proxy assumptions are used, label the resulting lens as estimated and keep the assumption visible.

### Alias ambiguity and retired mappings

- If the runtime model ID is not a clean current pricing SKU, record the replacement mapping and mark it `migration-required`.
- Do not price retired aliases as if they were active models.

### Preview-model volatility

- Keep the pricing retrieval date beside every Gemini rate used.
- Recalculate all recommendations before launch if Google changes preview pricing or migrates the preview IDs.

### Multiple successful tool invocations

- Count and price each distinct persisted success separately.
- Do not roll multiple successful `experience_version` outcomes into one thread-level credit.

## Method Refresh Triggers

Refresh this method before billing launch if any of the following changes:

- the default generation route leaves Gemini preview models;
- Anthropic becomes an active route and the config is migrated off Sonnet 3.5 aliases;
- conversation model pricing changes materially;
- generation token usage starts being persisted;
- failure leakage becomes measurable from a larger sample;
- observed successful-invocation mix gains enough fast or refine volume to change the weight table.
