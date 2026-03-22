## 1. Foundation Tokens and Typography

- [x] 1.1 Define Sunlit Atelier semantic tokens in shared web styles (surface/content/border/brand/state/elevation/motion).
- [x] 1.2 Introduce and configure the chosen sans-serif + cursive font pairing with explicit role mapping.
- [x] 1.3 Replace route-local hardcoded color/elevation values with shared semantic token usage in existing style definitions.
- [x] 1.4 Add responsive and reduced-motion baseline rules aligned with the new motion contract.

## 2. Shared State and Copy Patterns

- [x] 2.1 Define a unified status-language mapping for runtime, connectivity, success, and failure states.
- [x] 2.2 Implement shared visual treatments for loading, empty, error, and success feedback states.
- [x] 2.3 Update generic error/loading copy helpers to use creator-centered language conventions.
- [x] 2.4 Ensure retry and recovery affordances remain available where failures are recoverable.

## 3. Marketing and Home Workspace Alignment

- [x] 3.1 Refactor landing hero and feature-card presentation to the Sunlit Atelier hierarchy.
- [x] 3.2 Restyle the authenticated home header, create row, and action controls using shared token + typography roles.
- [x] 3.3 Replace current thread-list loading and empty treatments with polished state-specific placeholders/messages.
- [x] 3.4 Align creation cards with the warm palette system and remove conflicting neutral-gray placeholder styling.

## 4. Chat Thread and Sandbox Alignment

- [x] 4.1 Update chat workspace shell, panel surfaces, and controls to shared design-system primitives.
- [x] 4.2 Replace infrastructure-centric runtime status labels with creator-centered status language.
- [x] 4.3 Introduce staged loading feedback for thread hydration, message submission, and preview availability.
- [x] 4.4 Harmonize desktop/mobile chat + sandbox hierarchy while preserving existing runtime behavior.

## 5. Authentication Surface Alignment

- [x] 5.1 Refactor sign-in and sign-up layouts to shared Sunlit Atelier component hierarchy.
- [x] 5.2 Refactor forgot-password and reset-password screens to shared state and copy patterns.
- [x] 5.3 Standardize auth loading/success/error messages and button states across all auth routes.
- [x] 5.4 Verify OAuth and email/password flows retain current behavior after visual/copy updates.

## 6. Validation and Regression Sweep

- [x] 6.1 Execute frontend tests covering auth routing, home workspace transitions, and chat runtime state updates.
- [x] 6.2 Run manual desktop/mobile QA for landing, home, chat, sandbox, and auth experiences.
- [x] 6.3 Validate contrast and readability for new token + typography combinations in all state variants.
- [x] 6.4 Capture a short rollout checklist for safe deployment and rollback ordering.
