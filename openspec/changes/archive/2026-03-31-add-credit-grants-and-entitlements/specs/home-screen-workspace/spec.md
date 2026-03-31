## ADDED Requirements

### Requirement: Show billing summary on authenticated home workspace

The authenticated home workspace SHALL request the billing summary from `GET /api/billing/me` when billing is enabled and SHALL display at least the effective plan label, remaining usable credits, and per-tier credit costs for `fast` and `quality` without blocking thread creation.

#### Scenario: Authenticated home loads billing strip

- **WHEN** an authenticated user loads `/` and billing is enabled
- **THEN** the workspace renders a visible billing summary sourced from the billing API

#### Scenario: Billing off or request failure does not break home

- **WHEN** billing is disabled or the billing summary request fails
- **THEN** the home workspace still renders the create input and thread carousel without a hard error state that prevents starting a new thread

## MODIFIED Requirements

_(none)_

## REMOVED Requirements

_(none)_
