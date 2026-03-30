## Why

Monti now has a pricing cost model and a monetization contract, but its runtime telemetry is still incomplete in the places that matter most for billing-grade measurement. Generation usage is dropped before persistence, router usage is discarded entirely, and conversation usage is only partially retained through raw provider traces.

This change is needed now because the next monetization phases depend on observed internal cost data rather than planning assumptions. Before adding a billing domain, credits, or Stripe enforcement, Monti needs a reliable usage-measurement layer that records observed usage at the correct execution boundaries without fabricating estimates.

## What Changes

- Add a canonical LLM usage telemetry capability that normalizes provider usage across generation calls, router calls, and native provider tool-calling turns.
- Persist retry-aware generation request telemetry, including request-level token totals when fully observed and `attempt_count` for generate/refine runs.
- Persist successful artifact-producing token usage on `experience_versions` using the existing artifact token columns.
- Persist aggregated conversation-model usage on `assistant_runs` across multi-round tool loops.
- Persist router-model request/response telemetry and router token usage correlated to each `generate_experience` execution.
- Update Supabase schema snapshots, generated database types, backend tests, and pricing documentation so observed-versus-unavailable usage becomes explicit.

## Capabilities

### New Capabilities
- `llm-usage-telemetry`: Defines Monti's canonical usage telemetry contract for provider-backed generation, router execution, and native tool-calling conversation turns, including observed-versus-unavailable semantics.

### Modified Capabilities
- `experience-persistence`: Generation and artifact persistence now store retry-aware request usage totals and successful-artifact token usage.
- `conversation-tool-loop`: Assistant runs now aggregate and persist conversation-model usage across completed tool-loop rounds.
- `llm-routing-decision`: Router execution now persists router-model request/response telemetry and normalized router token usage for each `generate_experience` execution that invokes the router.
- `native-provider-tool-calling`: Completed provider-native conversation turns now expose normalized usage telemetry through the canonical adapter contract.

## Impact

- Backend LLM contracts and adapters in `backend/src/llm/`, including generation providers, router services, and native tool-calling adapters.
- Conversation/runtime orchestration in `backend/src/chat-runtime/` and `backend/src/experience/`.
- Persistence repositories and services in `backend/src/persistence/`.
- Supabase migrations, declarative schema snapshots, and generated database types.
- Pricing and monetization docs in `docs/pricing/` that currently describe generation/router usage as missing or assumption-heavy.
