# Plan Recommendation

Last updated: 2026-03-30

## Recommendation Summary

This change is planning-only, so the recommendation below is a launch-planning anchor rather than a final pricing-page commitment.

### Proposed launch packaging


| Item                  | Recommendation        | Rationale                                                                                                                          |
| --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Free allowance        | `15 credits / month`  | Enough for three quality runs or fifteen fast runs, while keeping free-tier variable cost low during learning.                     |
| Paid allowance        | `150 credits / month` | Supports roughly one quality run per day, or heavier fast-mode exploration, without forcing immediate top-ups.                     |
| Planning price anchor | `$10 / month`         | Leaves room for preview volatility, limited post-rollout telemetry history, and future non-billable leakage without making the included allowance tiny. |
| `fast` weight         | `1 credit`            | Maps closely to the current full monetized-success planning cost for the active fast route.                                        |
| `quality` weight      | `5 credits`           | Matches the full-cost ratio more closely than the raw `8x` generation spread because conversation overhead is fixed.               |
| Top-up pack           | `300 credits for $4`  | Clean multiple of the quality weight and easy to explain.                                                                         |


### Recommended policy shape

- Use a hybrid margin approach:
  - absorb stable fast-versus-quality route differences in the credit weights;
  - absorb preview volatility, limited telemetry history, and non-billable leakage in the plan margin.
- Do not use automatic overage billing at launch.
- Make top-ups available only to paid users.
- Consume monthly included credits before top-up credits.
- Let top-up credits persist while the subscription remains active; included monthly credits should reset each billing cycle and not roll over.

This keeps the customer story simple while keeping liability bounded.

## Why These Numbers

### Planning cost anchors behind the recommendation

Using the method in `docs/pricing/cost-estimation-method.md`:


| Tier      | Planning full monetized-success cost | Notes                                                                                                               |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `fast`    | about `$0.0099`                      | Active route: `gemini-3.1-flash-lite-preview`, plus observed `gpt-5.4` conversation overhead and 15% leakage factor |
| `quality` | about `$0.0479`                      | Active route: `gemini-3.1-pro-preview`, plus observed `gpt-5.4` conversation overhead and 15% leakage factor        |


That means:

- `quality` is about `4.85x` the full planning cost of `fast`;
- a `5-credit` weight for `quality` is simpler and more faithful to full cost than an `8-credit` weight tied only to raw generation list prices.

### Effective retail value per run under the planning anchor

At `$10 / 150 credits`, each credit is worth about `$0.0667`.


| Outcome               | Credits consumed | Effective revenue | Planning cost | Comment                                                                             |
| --------------------- | ---------------- | ----------------- | ------------- | ----------------------------------------------------------------------------------- |
| One `fast` success    | `1`              | `$0.0667`         | `$0.0099`     | Leaves room for measurement error and leakage                                       |
| One `quality` success | `5`              | `$0.3333`         | `$0.0479`     | Large margin buffer is intentional because the current estimate is assumption-heavy |


The margin buffer is not because the current measured cost is high. It is because the current measurement quality is low.

## Unit-Economics Sanity Checks

### Base-case usage

If a paid user spends all `150` monthly credits as `quality` runs:

- quality runs included: `30`
- planning monthly variable cost: about `30 * $0.0479 = $1.44`
- planning gross margin at `$10 / month`: about `85.6%`

If a paid user spends all `150` credits as `fast` runs:

- fast runs included: `150`
- planning monthly variable cost: about `150 * $0.0099 = $1.48`
- planning gross margin at `$10 / month`: about `85.2%`

This is a useful property of the `1` / `5` weight table: fast-heavy and quality-heavy credit exhaustion land in a similar planning-cost band.

### Quality-mix sensitivity


| Scenario                                                    | Approximate monthly variable cost at full allowance | Readout                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| All `fast`                                                  | about `$1.48`                                       | Similar to all-quality because the credit weights normalize the mix                                         |
| All `quality`                                               | about `$1.44`                                       | Planned baseline for a power user                                                                           |
| `quality` cost doubles because token estimates were too low | about `$2.88`                                       | Still workable at the proposed allowance and price, but this would justify rechecking weights before launch |


### Routing-mix change sensitivity

Using the same token envelope and overhead assumptions:


| Replacement route                       | Approximate full monetized-success cost | Implication                                                                                           |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `openai / gpt-5-mini` fast              | about `$0.0116`                         | Slightly higher than Gemini fast; current weight table still workable                                 |
| `openai / gpt-5.4` quality              | about `$0.0588`                         | Higher than Gemini quality, but still within the current weight buffer                                |
| `anthropic / claude-haiku-4-5` fast     | about `$0.0227`                         | More than 2x Gemini fast; if Anthropic becomes the active fast route, recompute weights before launch |
| `anthropic / claude-sonnet-4-6` quality | about `$0.0593`                         | Similar to OpenAI quality sensitivity                                                                 |


### Non-billable failure leakage sensitivity

The current planning model allocates a `15%` leakage factor because the live sample contains no failures and no retry chains.


| Leakage factor | Fast full cost  | Quality full cost | Implication                                                                    |
| -------------- | --------------- | ----------------- | ------------------------------------------------------------------------------ |
| `15%`          | about `$0.0099` | about `$0.0479`   | Current recommendation basis                                                   |
| `30%`          | about `$0.0112` | about `$0.0542`   | Still acceptable with current plan margin                                      |
| `50%`          | about `$0.0131` | about `$0.0613`   | Still survivable, but too high to ignore; instrument and revisit before launch |


### Observed-versus-estimated cost caveat

This recommendation should not be treated as a final billing launch decision because:

- the only observed successful run is a single `quality` generation;
- the runtime now persists generation, router, and conversation usage for new rows, but the current recommendation is still anchored to a historical sample captured before that rollout;
- the active Gemini generation routes are preview models;
- fast and refine usage are not yet observed in the live sample.

The recommendation is therefore conservative on allowance and generous on margin by design.

## Remaining Stakeholder Questions

- What minimum contribution-margin floor should Monti target at launch: `70%`, `80%`, or higher?
- Is the free tier meant to optimize acquisition, classroom trial, or only first-run product understanding?
- Should purchased top-up credits survive cancellation, or pause until reactivation?
- Is one paid plan enough for launch, or does product want a second plan for teacher or team usage?

## Follow-On Changes Required Before Billing Launch

- Gather enough fresh post-rollout telemetry to replace the current proxy-based generation assumptions with observed generation and router usage.
- Decide whether later ops/reconciliation work needs a true per-attempt retry table beyond `generation_runs.attempt_count` and request-level totals.
- Migrate the Anthropic config off `claude-3-5-sonnet-latest`.
- Replace or freeze Gemini preview model assumptions before customer billing begins.
- Add billing primitives: credit ledger, entitlement checks, top-up purchase flow, and audit-friendly usage events.
- Add analytics views or reports for successful-run mix, failure leakage, and allowance burn by tier.

## Refresh Triggers

Recalculate this recommendation before launch if any of the following happen:

- provider pricing changes;
- Gemini preview models move, deprecate, or reprice;
- default routing changes providers or models;
- observed fast/refine volume becomes material;
- generation token telemetry becomes available;
- real failure leakage exceeds the provisional 15% allocation.
