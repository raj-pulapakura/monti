# Provider Pricing Research

Last updated: 2026-03-30

## Purpose

This document is the pricing evidence base for Monti's planning-phase cost model. It records:

- the runtime routes Monti can currently take;
- the persistence surfaces that expose billable and non-billable cost signals;
- the official provider pricing pages and model-status sources used for estimation; and
- the normalization table that maps Monti runtime model IDs to billable pricing SKUs.

## Evidence Set

### Runtime code and schema evidence

- `backend/src/llm/llm-config.service.ts`
- `backend/src/llm/llm-decision-router.service.ts`
- `backend/src/llm/llm-router.service.ts`
- `backend/src/llm/llm.types.ts`
- `backend/src/llm/providers/gemini-llm.provider.ts`
- `backend/src/llm/providers/openai-llm.provider.ts`
- `backend/src/llm/providers/anthropic-llm.provider.ts`
- `backend/src/chat-runtime/tools/generate-experience-tool.service.ts`
- `backend/src/chat-runtime/services/conversation-loop.service.ts`
- `backend/src/chat-runtime/services/chat-runtime.repository.ts`
- `backend/src/experience/services/experience-orchestrator.service.ts`
- `backend/src/experience/services/prompt-builder.service.ts`
- `backend/src/persistence/services/experience-persistence.repository.ts`
- `supabase/schemas/experiences.sql`
- `supabase/migrations/20260315000500_decouple_conversation_generation.sql`

### Live observation snapshot

- Data source: production Supabase tables queried on 2026-03-30 with service-role access.
- Observation window available today: 2026-03-29T10:20:00.547671Z to 2026-03-29T10:22:46.893770Z.
- Current sample size:
  - `assistant_runs`: 1
  - `tool_invocations`: 1
  - `generation_runs`: 1
  - `experience_versions`: 1
  - successful `generate_experience` invocations: 1
  - failed `generate_experience` invocations: 0

This is enough to ground the method in real persisted data, but not enough to claim observed steady-state averages.

## Runtime Inventory

### Active config snapshot


| Surface                                   | Current runtime value                                                            | Pricing relevance                                                                                                 | Evidence                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation loop                         | `openai` / `gpt-5.4` / `maxTokens=4096`                                          | Every assistant turn pays conversation overhead before or between tool calls.                                     | `backend/src/llm/llm-config.service.ts`, `backend/src/chat-runtime/services/conversation-loop.service.ts`                              |
| Router model                              | `openai` / `gpt-5-mini` / `max_output_tokens=1024`                               | Auto-mode runs can incur a separate routing-model call before generation routing is chosen.                       | `backend/src/llm/llm-config.service.ts`, `backend/src/llm/llm-decision-router.service.ts`                                              |
| Default generation route: `fast`          | `gemini` / `gemini-3.1-flash-lite-preview`                                       | Active low-cost artifact path.                                                                                    | `backend/src/llm/llm-config.service.ts`, `backend/src/llm/llm-router.service.ts`                                                       |
| Default generation route: `quality`       | `gemini` / `gemini-3.1-pro-preview`                                              | Active premium artifact path.                                                                                     | `backend/src/llm/llm-config.service.ts`, `backend/src/llm/llm-router.service.ts`                                                       |
| Dormant configured alternative: OpenAI    | `fast -> gpt-5-mini`, `quality -> gpt-5.4`                                       | Configured and billable if routing changes, but not today's default generation route.                             | `backend/src/llm/llm-config.service.ts`                                                                                                |
| Dormant configured alternative: Anthropic | `fast -> claude-3-5-sonnet-latest`, `quality -> claude-3-5-sonnet-latest`        | Configured, but the family is retired and cannot be treated as a clean current SKU.                               | `backend/src/llm/llm-config.service.ts`, Anthropic deprecation docs                                                                    |
| User-selected generation mode             | `chat_messages.content_json.generationMode` can force `fast` or `quality`        | When present, Monti bypasses the router decision and directly resolves the configured tier route.                 | `backend/src/chat-runtime/services/conversation-loop.service.ts`, `backend/src/chat-runtime/tools/generate-experience-tool.service.ts` |
| Automatic retry behavior                  | One automatic retry on max-token failure when `maxTokens` was not user-specified | Retry cost belongs to the same successful request boundary, but attempt-level token usage is not persisted today. | `backend/src/experience/services/experience-orchestrator.service.ts`                                                                   |


### Successful-run path

Monti's successful billable unit is not a thread or an assistant run. The runtime path is:

1. `assistant_runs` starts the conversation loop and stores conversation-provider metadata.
2. `tool_invocations` records each `generate_experience` execution within that assistant run.
3. `generation_runs` records the generation request lifecycle.
4. `experience_versions` stores the persisted artifact outcome.

Pricing therefore has to anchor on successful `generate_experience` invocations that produce a persisted `experience_version`, not on thread count or assistant-run count.

### Billing-relevant persistence surfaces


| Surface               | What it captures today                                                                                                   | What it is good for                                                                   | Important gap                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `assistant_runs`      | Conversation lifecycle, selected routing tier/provider/model, raw provider request/response, conversation provider/model | Conversation overhead, assistant-run status, spot-checking OpenAI usage in raw traces | Not a billable unit by itself; router usage is not normalized into dedicated token fields                        |
| `tool_invocations`    | Per-tool execution status, tool args/result, selected provider/model, generation/version correlation                     | The correct place to count successful `generate_experience` invocations               | No explicit retry-attempt log; multiple successes can happen inside one assistant run                            |
| `generation_runs`     | Generation request lifecycle, operation, provider/model, final status, output shape summary                              | Request-level success/failure counts and operation segmentation                       | No provider usage ledger, no attempt breakdown                                                                   |
| `experience_versions` | Persisted artifact, provider/model, quality mode, latency, token columns                                                 | Lower-bound successful artifact evidence                                              | `tokens_in` and `tokens_out` exist but are currently null in observed data and not populated by persistence code |


## Official Provider Pricing Sources

Retrieved on 2026-03-30 from official provider documentation only.

### OpenAI


| Source                | URL                                                                                                                  | Relevant details                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI API Pricing    | [https://openai.com/api/pricing/](https://openai.com/api/pricing/)                                                   | `GPT-5.4`: $2.50 / 1M input, $0.25 / 1M cached input, $15.00 / 1M output. `GPT-5.4 mini`: $0.75 / 1M input, $0.075 / 1M cached input, $4.50 / 1M output.                                             |
| GPT-5 mini model page | [https://developers.openai.com/api/docs/models/gpt-5-mini](https://developers.openai.com/api/docs/models/gpt-5-mini) | `gpt-5-mini` is a distinct current model and pricing SKU, not just another label for `GPT-5.4 mini`. Pricing shown on the model page: $0.25 / 1M input, $0.025 / 1M cached input, $2.00 / 1M output. |


OpenAI notes relevant to Monti:

- `gpt-5.4` is an exact current match for Monti's conversation model.
- `gpt-5-mini` is an exact current match for Monti's router model and configured OpenAI fast route.
- `gpt-5-mini` must not be normalized to `GPT-5.4 mini` by name similarity.

### Anthropic


| Source                       | URL                                                                                                                                        | Relevant details                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Anthropic pricing            | [https://platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing)                       | `Claude Sonnet 4.6`: $3 / MTok input, $15 / MTok output. `Claude Haiku 4.5`: $1 / MTok input, $5 / MTok output. |
| Anthropic models overview    | [https://platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)       | Current core lineup centers on `claude-opus-4-6`, `claude-sonnet-4-6`, and `claude-haiku-4-5(-20251001)`.       |
| Anthropic model deprecations | [https://platform.claude.com/docs/en/about-claude/model-deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) | Claude Sonnet 3.5 snapshots were retired on 2025-10-28.                                                         |


Anthropic notes relevant to Monti:

- Monti's configured Anthropic runtime model is `claude-3-5-sonnet-latest`.
- Anthropic's current docs no longer treat the Sonnet 3.5 family as current; the retirement notice covers the Sonnet 3.5 snapshots that the `latest` alias historically pointed at.
- Any Anthropic estimate for Monti must therefore be treated as migration-required and mapped to a replacement family explicitly rather than billed against a retired alias.

### Google Gemini


| Source                       | URL                                                                                            | Relevant details                                                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini Developer API pricing | [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) | `gemini-3.1-pro-preview`: $2.00 / 1M input and $12.00 / 1M output for prompts up to 200k tokens, then $4.00 / 1M input and $18.00 / 1M output above 200k. `gemini-3.1-flash-lite-preview`: $0.25 / 1M input and $1.50 / 1M output for text/image/video. |
| Gemini models catalog        | [https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)   | `Gemini 3.1 Pro Preview` and `Gemini 3.1 Flash-Lite` are current preview models. The models page explicitly warns that older `Gemini 3 Pro Preview` was shut down on 2026-03-09 and points users to `Gemini 3.1 Pro Preview`.                           |


Google notes relevant to Monti:

- Monti's active generation routes match current preview SKUs exactly: `gemini-3.1-pro-preview` and `gemini-3.1-flash-lite-preview`.
- Both active Gemini runtime models are preview models. Google warns that preview models may change before becoming stable and may have more restrictive rate limits.
- Gemini Pro Preview has prompt-length-dependent pricing and optional grounding charges. For Monti's current prompt builder and observed prompt sizes, the under-200k bracket is the relevant default assumption.

## Model Status And Normalization Evidence


| Runtime model ID or alias       | Runtime surface                                     | Official status       | Official evidence                        | Pricing implication                                                   |
| ------------------------------- | --------------------------------------------------- | --------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `gpt-5.4`                       | Conversation model, configured OpenAI quality route | Current and exact     | OpenAI API Pricing                       | Use `GPT-5.4` pricing directly                                        |
| `gpt-5-mini`                    | Router model, configured OpenAI fast route          | Current and exact     | GPT-5 mini model page                    | Use `GPT-5 mini` pricing directly                                     |
| `gemini-3.1-pro-preview`        | Active quality generation route                     | Current preview model | Gemini pricing + models pages            | Usable for estimation, but preview volatility must be flagged         |
| `gemini-3.1-flash-lite-preview` | Active fast generation route                        | Current preview model | Gemini pricing + models pages            | Usable for estimation, but preview volatility must be flagged         |
| `claude-3-5-sonnet-latest`      | Configured Anthropic fast and quality alternatives  | Retired family alias  | Anthropic models overview + deprecations | Do not treat as a current billable SKU; migration assumption required |


## Normalization Table

This table is the pricing-SKU mapping Monti should use for estimation until the runtime config changes.


| Runtime surface                      | Runtime provider/model                   | Pricing SKU used for estimation                    | Status               | Notes                                                                                                                             |
| ------------------------------------ | ---------------------------------------- | -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Conversation                         | `openai / gpt-5.4`                       | OpenAI `GPT-5.4`                                   | `exact`              | Current fixed conversation model.                                                                                                 |
| Router                               | `openai / gpt-5-mini`                    | OpenAI `GPT-5 mini`                                | `exact`              | Separate current model from `GPT-5.4 mini`.                                                                                       |
| Generation `fast` default            | `gemini / gemini-3.1-flash-lite-preview` | Gemini `gemini-3.1-flash-lite-preview`             | `exact`              | Preview pricing; use paid text rates.                                                                                             |
| Generation `quality` default         | `gemini / gemini-3.1-pro-preview`        | Gemini `gemini-3.1-pro-preview`                    | `exact`              | Preview pricing; use under-200k prompt bracket unless observed prompts exceed that threshold.                                     |
| Configured OpenAI `fast` fallback    | `openai / gpt-5-mini`                    | OpenAI `GPT-5 mini`                                | `exact`              | Not active by default today.                                                                                                      |
| Configured OpenAI `quality` fallback | `openai / gpt-5.4`                       | OpenAI `GPT-5.4`                                   | `exact`              | Not active by default today.                                                                                                      |
| Configured Anthropic alternative     | `anthropic / claude-3-5-sonnet-latest`   | Anthropic `claude-sonnet-4-6` for sensitivity only | `migration-required` | The configured alias points at a retired family. Use only as a replacement sensitivity scenario until runtime config is migrated. |


## Key Conclusions

- Monti's live default generation cost model is currently Gemini-based, not provider-diversified.
- OpenAI costs still matter because the conversation loop is always `gpt-5.4`, and auto-mode routing can add a `gpt-5-mini` call.
- Anthropic is configured but not launch-ready for pricing because the configured Sonnet 3.5 alias is retired.
- Current cost work can proceed with official pricing and one real observed run, but any launch recommendation must be labeled preview-sensitive and assumption-heavy until generation token usage is persisted.

