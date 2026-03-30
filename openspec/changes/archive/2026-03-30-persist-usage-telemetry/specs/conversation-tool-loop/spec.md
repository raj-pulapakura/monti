# conversation-tool-loop Specification

## ADDED Requirements

### Requirement: Persist aggregated conversation-model usage across completed loop rounds
The system SHALL aggregate observed conversation-model token usage across completed rounds in an assistant run and persist the aggregate on the assistant-run telemetry record only when every completed round in that run exposed observed usage.

#### Scenario: Single-round assistant run persists conversation usage
- **WHEN** an assistant run completes after one conversation-model round and that round exposes observed usage
- **THEN** the assistant-run telemetry stores the observed conversation-model token totals for that run

#### Scenario: Multi-round tool loop persists aggregated conversation usage
- **WHEN** an assistant run completes after multiple conversation-model rounds and every completed round exposes observed usage
- **THEN** the assistant-run telemetry stores the aggregate conversation-model token totals across those rounds

#### Scenario: Missing round usage leaves run totals unavailable
- **WHEN** any completed conversation-model round in an assistant run lacks observed usage
- **THEN** the assistant-run telemetry leaves aggregate conversation-model token totals unavailable rather than storing a partial total
