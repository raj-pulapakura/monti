## Why

Monti needs a pricing and monetization strategy that is defensible against real model cost, not intuition. Costs vary by provider, model, quality mode, and orchestration path, and current runtime model IDs do not map cleanly enough to public pricing tables to support a confident plan without a dedicated research and estimation pass.

We need a planning-only change now to define the billable successful-run policy, the provider pricing research method, and a decision-ready pricing recommendation before building billing, entitlements, or paywalls.

## What Changes

- Add markdown planning deliverables that define Monti's billable successful-run policy, including which outcomes consume credits and which do not.
- Add markdown research deliverables under `docs/pricing/` that capture official current provider pricing for OpenAI, Anthropic, and Google Gemini, including retrieval date, source links, and normalized mapping from Monti runtime model IDs to billable pricing SKUs.
- Add a repeatable cost-estimation method that uses Monti's persisted run metadata, provider/model selection, quality mode, and actual token counts when available, while explicitly documenting assumptions, fallback evidence, and confidence level when telemetry is missing.
- Add explicit policy treatment for automatic retries, system-deduplicated idempotent replays, intentional repeat user requests, and multiple successful tool invocations that occur inside one assistant run.
- Add a pricing decision pack that recommends plan packaging, credit weights, top-up policy, and unit-economics guardrails for a per-successful-run model.
- Document telemetry sufficiency and gaps, including what can be estimated immediately from current data, what requires follow-on instrumentation, and what non-billable traffic still creates cost leakage that must be reflected in margin guardrails.
- Require every estimate to name its observation window, active runtime config snapshot, evidence sources, and confidence classification so later pricing debates can be traced back to concrete inputs.
- This phase produces markdown files only. No billing code, Stripe integration, entitlement ledger, API changes, or schema changes are included.

## Capabilities

### New Capabilities
- `pricing-cost-model`: Define the research inputs, billable successful-run policy, cost-estimation methodology, and decision-ready monetization outputs required to price Monti responsibly.

### Modified Capabilities
- None.

## Impact

- New markdown outputs are expected under `docs/pricing/` in a follow-on apply phase, in addition to the OpenSpec artifacts for this change.
- High-level code and data references for this work include `backend/src/llm/llm-config.service.ts`, `backend/src/chat-runtime/tools/generate-experience-tool.service.ts`, `backend/src/chat-runtime/services/conversation-loop.service.ts`, `backend/src/chat-runtime/services/chat-runtime.repository.ts`, `backend/src/experience/services/experience-orchestrator.service.ts`, `backend/src/persistence/services/experience-persistence.repository.ts`, `supabase/schemas/experiences.sql`, and `supabase/migrations/20260315000500_decouple_conversation_generation.sql`.
- External research dependencies include official provider pricing sources from OpenAI, Anthropic, and Google.
- No customer-facing product behavior, billing flow, or backend runtime behavior changes in this phase.
