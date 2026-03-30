# llm-usage-telemetry Specification

## Purpose
TBD - created by archiving change persist-usage-telemetry. Update Purpose after archive.
## Requirements
### Requirement: Normalize provider usage into a canonical telemetry contract
The system SHALL normalize provider usage for generation requests, router model requests, and native provider tool-calling conversation turns into a canonical telemetry contract. The canonical contract MUST represent input-token count, output-token count, total-token count when derivable, an availability state of `observed` or `unavailable`, and provider-specific raw usage metadata when available.

#### Scenario: Provider returns explicit usage counts
- **WHEN** a supported provider returns explicit token usage for a completed generation, router, or conversation-tool turn
- **THEN** the system emits canonical usage telemetry with observed input/output counts and the corresponding raw usage snippet

#### Scenario: Provider omits usage counts
- **WHEN** a completed provider response does not expose usage metadata
- **THEN** the system emits canonical usage telemetry marked `unavailable` with no fabricated token counts

### Requirement: Runtime telemetry MUST not fabricate estimated or partial totals
The runtime telemetry layer MUST persist or emit only observed provider usage. It MUST NOT infer token counts from character length, pricing heuristics, or partial aggregation across a multi-call boundary and represent those values as observed usage.

#### Scenario: Multi-attempt request includes one missing attempt usage record
- **WHEN** one generation attempt in a multi-attempt request lacks observed usage while another attempt exposes usage
- **THEN** the request-level aggregate telemetry remains unavailable rather than storing a partial observed total

#### Scenario: Multi-round conversation run includes one missing round usage record
- **WHEN** one completed conversation round in an assistant run lacks observed usage while another round exposes usage
- **THEN** the run-level aggregate telemetry remains unavailable rather than storing a partial observed total
