## ADDED Requirements

### Requirement: Record official provider pricing inputs
The project SHALL maintain a markdown research document that records the official pricing inputs used to estimate Monti's per-successful-run cost model.

#### Scenario: Research covers all relevant providers
- **WHEN** the provider pricing research document is prepared
- **THEN** it includes official current pricing sources for OpenAI, Anthropic, and Google Gemini with retrieval date and source URL

#### Scenario: Research captures pricing-normalization details
- **WHEN** a Monti runtime model ID or alias does not exactly match a provider pricing label
- **THEN** the research document records the normalization mapping, the pricing SKU used for estimation, whether the mapping is exact or assumption-based, and any unresolved ambiguity

#### Scenario: Research flags retired or preview runtime models
- **WHEN** a Monti runtime model ID is preview-only, legacy, deprecated, or retired in official provider documentation
- **THEN** the research document records that status, cites the official source, and marks whether a pricing estimate is still usable or requires a runtime migration assumption

### Requirement: Define billable successful-run policy
The project SHALL maintain a markdown policy document that defines exactly which Monti run outcomes consume credits in the pricing model.

#### Scenario: Successful generation is billable
- **WHEN** a generate or refine flow completes successfully and produces a persisted experience version or equivalent successful artifact outcome
- **THEN** the policy defines that successful run as billable

#### Scenario: Failed or system-deduplicated outcomes are not billable
- **WHEN** a run fails, is refused, is canceled, is rejected by validation or safety checks, or is deduplicated by system idempotency handling that reuses an already-counted result
- **THEN** the policy defines that outcome as non-billable

#### Scenario: Intentional repeat request is classified separately from idempotent replay
- **WHEN** a user intentionally triggers a new successful generate or refine action that is not deduplicated by the system
- **THEN** the policy defines whether that new success is billable independently of prior similar prompts

#### Scenario: Multiple successful tool invocations inside one assistant run are classified explicitly
- **WHEN** one assistant run produces more than one successful `generate_experience` invocation
- **THEN** the policy states whether each persisted success is billable or excluded only by a documented system-side dedup rule

### Requirement: Define repeatable cost-estimation methodology
The project SHALL maintain a markdown method document that specifies how to calculate Monti's artifact-producing cost, successful-request cost, and full monetized-success cost from product telemetry and official provider pricing.

#### Scenario: Actual token counts are available
- **WHEN** token counts and run metadata are available for the successful run being analyzed
- **THEN** the method calculates cost from the normalized provider price schedule and the actual observed token counts for that run

#### Scenario: Successful request includes internal retries
- **WHEN** a billable successful request required automatic retries or more than one provider call inside the same request boundary
- **THEN** the method classifies whether those additional costs are observed, estimated, or excluded and records the rationale

#### Scenario: Telemetry is incomplete
- **WHEN** a required cost component such as input tokens, output tokens, or orchestration overhead is not directly observed
- **THEN** the method separates observed cost from estimated cost and records the assumption, rationale, and expected impact

#### Scenario: Observation window and weighting basis are declared
- **WHEN** an average cost or recommendation is computed
- **THEN** the method records the observation window, sample sizes, weighting dimensions, and active runtime config snapshot used for that estimate

#### Scenario: Non-billable cost leakage is handled explicitly
- **WHEN** failed, refused, canceled, or otherwise non-billable traffic still incurs provider or orchestration cost during the observation window
- **THEN** the method states whether that leakage is allocated into full monetized-success cost or excluded from that lens, and records the rationale

### Requirement: Preserve evidence and confidence trail
The project SHALL make each pricing estimate reproducible from an explicit evidence set and confidence classification.

#### Scenario: Estimate records evidence inputs
- **WHEN** a cost estimate or pricing recommendation is published
- **THEN** it cites the pricing-source retrieval date, source URLs, observation window, runtime config snapshot, and sample sizes used

#### Scenario: Estimate records confidence level
- **WHEN** a cost estimate or pricing recommendation depends on mixed observed and assumed inputs
- **THEN** it labels the estimate with a confidence classification and identifies the assumptions that limit confidence

### Requirement: Produce decision-ready pricing recommendation
The project SHALL maintain a markdown pricing recommendation that turns the cost model into a proposed monetization plan for Monti.

#### Scenario: Recommendation includes plan packaging
- **WHEN** the pricing recommendation is complete
- **THEN** it includes a proposed free allowance, paid plan allowance, quality-mode weightings, and top-up policy

#### Scenario: Recommendation includes economics guardrails
- **WHEN** the pricing recommendation is complete
- **THEN** it includes unit-economics sanity checks, key sensitivity drivers, explicit treatment of overhead and non-billable leakage, and explicit follow-on implementation changes required before billing launch

#### Scenario: Recommendation declares refresh triggers
- **WHEN** the pricing recommendation is complete
- **THEN** it identifies the pricing, model, routing, or telemetry changes that require the recommendation to be recalculated before billing launch
