## Why

Monti already has a promising warm visual base, but key user-facing surfaces currently feel inconsistent in tone, visual hierarchy, and interaction feedback. The UI overhaul is needed now to establish a cohesive, ownable design language before additional product growth compounds design drift and UX debt.

## What Changes

- Introduce a unified Sunlit Atelier design language with shared tokens for color, typography, spacing, radius, elevation, and motion.
- Add a dual-type system: expressive cursive display typography for hero emphasis and a high-legibility sans-serif system for core product UI.
- Standardize interactive and feedback patterns across components (buttons, inputs, cards, chips, banners, status indicators, loading states, and empty states).
- Replace infrastructure-centric runtime/status messaging with user-centered studio language appropriate for an educational creation product.
- Apply the system consistently across marketing, home workspace, chat thread runtime, sandbox preview, and authentication screens.
- Remove redundant or hacky-looking status surfaces and unnecessary copy that do not help user decisions.

## Capabilities

### New Capabilities
- `sunlit-atelier-design-language`: Defines the app-wide design foundation (visual tokens, type roles, motion principles, component-state patterns, and product copy voice) used by all primary web surfaces.

### Modified Capabilities
- `home-screen-workspace`: Tighten requirements for cohesive hierarchy, creation-card presentation, and polished loading/empty/error states aligned with the Sunlit Atelier system.
- `chat-thread-runtime`: Add user-facing requirements for readable runtime status communication, unified progress/loading feedback, and streamlined workspace copy across chat + preview.
- `user-authentication`: Align authentication screen layout and state feedback language (loading/success/error) with shared design-system rules while preserving auth behavior.

## Impact

- Affected frontend files include shared styles/tokens and core route UI in `web/app/globals.css`, `web/app/page.tsx`, `web/app/chat/[threadId]/page.tsx`, and auth pages.
- Requires introducing and enforcing a shared UI vocabulary for status, loading, and error messaging.
- No backend API contract changes and no database schema changes are required.
- Requires targeted visual regression and flow validation across desktop/mobile layouts.
