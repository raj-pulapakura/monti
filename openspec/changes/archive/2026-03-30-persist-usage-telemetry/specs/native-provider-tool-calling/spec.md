# native-provider-tool-calling Specification

## ADDED Requirements

### Requirement: Emit normalized usage telemetry for completed provider-native turns
The canonical tool-turn response MUST include normalized usage telemetry for the completed provider-native conversation turn. When provider usage is observed, the canonical response MUST expose the normalized counts; when provider usage is unavailable, the canonical response MUST represent that state explicitly instead of omitting telemetry silently.

#### Scenario: Completed provider-native turn includes observed usage
- **WHEN** a provider-native conversation turn completes and the provider response exposes token usage
- **THEN** the canonical tool-turn response includes normalized observed usage telemetry for that turn

#### Scenario: Completed provider-native turn lacks usage metadata
- **WHEN** a provider-native conversation turn completes without exposing token usage
- **THEN** the canonical tool-turn response includes usage telemetry marked unavailable with no fabricated token counts
