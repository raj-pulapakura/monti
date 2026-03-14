## 1. Backend foundation and contracts

- [x] 1.1 Define request/response DTOs for generate and refine endpoints, including validation rules for required and optional fields.
- [x] 1.2 Create NestJS module scaffolding for generation orchestration, LLM provider routing, payload validation, and safety enforcement.
- [x] 1.3 Add environment configuration for provider keys, default model selection, token limits, and timeout settings.
- [x] 1.4 Implement normalized API error envelope and exception mapping for provider, validation, timeout, and refusal failures.

## 2. Generation flow implementation

- [x] 2.1 Implement prompt-building logic for initial generation using prompt, format, and audience metadata.
- [x] 2.2 Implement provider client abstraction with fast-default routing policy and optional quality mode override.
- [x] 2.3 Add structured output parsing and strict validation for `title`, `description`, `html`, `css`, and `js`.
- [x] 2.4 Add bounded retry behavior for token-limit truncation cases and return actionable failure messages.
- [x] 2.5 Expose synchronous `POST /generate` endpoint and verify response contract.

## 3. Refinement flow implementation

- [x] 3.1 Implement refinement prompt builder that includes original prompt, prior artifact, and user refinement instruction.
- [x] 3.2 Implement full-regeneration refinement orchestration reusing provider routing and validation pipeline.
- [x] 3.3 Expose synchronous `POST /refine` endpoint and validate required previous artifact fields.
- [x] 3.4 Ensure refinement responses pass the same safety guards and output limits as generation responses.

## 4. Safety and rendering constraints

- [x] 4.1 Implement server-side disallowed-pattern checks for generated payloads (for example external resource loading attempts).
- [x] 4.2 Ensure API contracts document iframe-only rendering expectations and sandbox requirements.
- [x] 4.3 Add backend tests covering malformed payload rejection, oversized output rejection, and safety guard rejection paths.

## 5. Frontend create/play/refine experience

- [x] 5.1 Replace scaffold page with create screen containing prompt input, format selector, audience selector, and generate/regenerate actions.
- [x] 5.2 Implement preview panel that renders generated experiences only via sandboxed iframe.
- [x] 5.3 Add refinement input workflow that submits to `POST /refine` and replaces the preview on success.
- [x] 5.4 Add loading and error states for generation and refinement requests, including duplicate-submit prevention.

## 6. Recent creations and validation

- [x] 6.1 Implement local storage schema for recent creations including id, title, prompt, timestamp, and payload fields.
- [x] 6.2 Add recent creations list UI with reopen behavior and enforce max history size of 10 entries.
- [x] 6.3 Add frontend tests for local history limit enforcement and reopen flow behavior.
- [x] 6.4 Execute end-to-end MVP smoke test: prompt -> generate -> play -> refine -> reopen from history.
