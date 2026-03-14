## Why

Monti needs a focused MVP that proves users can turn a prompt into a playable interactive learning experience, then refine it with natural language feedback. Building this core loop now validates product value before investing in non-essential platform features.

## What Changes

- Add a complete prompt-to-play generation flow that accepts user prompt, format, and audience level, and returns a runnable learning experience payload.
- Add a refinement flow that regenerates an experience using prior output plus user feedback.
- Add frontend create experience screen with generate/regenerate controls and live preview.
- Add secure rendering contract for generated UI in a sandboxed iframe with no external libraries or network access.
- Add recent creations persistence in browser local storage (latest 10 experiences).
- Add structured output validation and error handling for LLM-generated `html`, `css`, and `js`.
- Add provider/model routing policy optimized for MVP: fast default generation and optional higher-quality regeneration path.

## Capabilities

### New Capabilities
- `experience-generation`: Generate a self-contained interactive learning experience from user prompt and selected format/audience metadata.
- `experience-refinement`: Regenerate an existing experience using user refinement instructions and previous generated artifact as context.
- `experience-preview-history`: Safely render generated experiences and maintain a local recent-creations list with reopen support.

### Modified Capabilities
- None.

## Impact

- Affected backend areas: new NestJS modules/controllers/services for generation orchestration, provider routing, validation, and safety checks.
- Affected frontend areas: new create/generate UI, refine controls, iframe preview container, and local storage recent list.
- Affected API surface: new generation/refinement endpoints and structured response contracts.
- External dependencies: LLM provider SDK/API integrations and associated environment variables.
- Operational impact: longer-running synchronous generation requests; must include robust timeout/error UX and token-limit retry behavior.
