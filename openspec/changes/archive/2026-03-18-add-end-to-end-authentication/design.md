## Context

Monti currently treats users as anonymous clients identified by browser-local `clientId`. That model is embedded across Next.js page flows, Nest API contracts, RPC ownership checks, and Supabase schema/indexes. The product now requires first-class identity, secure access control, and user-owned data across devices.

This change is cross-cutting:
- **Frontend**: route segmentation (`/`, `/auth/*`, `/app`), auth lifecycle UX, protected navigation, authenticated API client behavior.
- **Backend**: bearer-token authentication, authenticated request context, controller/repository contract changes, auth-aware event streaming.
- **Database**: ownership migration from `client_id` to `user_id`, RLS policies, RPC signature and ownership checks, migration/backfill behavior.

Constraints:
- Supabase/Postgres is the source of truth for auth and data persistence.
- Nest remains the primary API boundary for application runtime behavior.
- Security and long-term reliability are prioritized over implementation effort.

## Goals / Non-Goals

**Goals:**
- Deliver complete user authentication flows: Google, Microsoft, Apple OAuth plus email/password sign-up/sign-in, email confirmation, forgot/reset password, and sign-out.
- Enforce protected app access at `/app` and keep `/` as a public landing page with marketing content.
- Replace anonymous ownership primitives (`clientId`) with authenticated `user_id` ownership for runtime and persistence paths.
- Enforce database-level access control using RLS for user-scoped tables.
- Ensure authenticated transport for all backend calls, including streaming runtime events.
- Perform a direct cutover without backward-compatibility requirements for anonymous development data.
- Keep email verification available but do not gate full app access on verified email in the current development phase.

**Non-Goals:**
- Introducing org/team/multi-tenant RBAC beyond single-user ownership.
- Building a custom identity provider or custom OAuth broker.
- Redesigning LLM routing, generation quality policy, or non-auth product workflows.
- Delivering admin tooling for user management beyond Supabase-native capabilities.

## Decisions

### 1) Adopt RLS-first data protection with mandatory `user_id` ownership

**Decision:** User-scoped tables (`chat_threads`, `chat_messages`, `assistant_runs`, `tool_invocations`, `sandbox_states`, `experiences`, `generation_runs`, and related records) will be owned by authenticated users through `user_id` and protected by Row Level Security.

**Rationale:** Database-enforced ownership is the most reliable guardrail against accidental data leaks from missed application filters.

**Alternatives considered:**
- **Service-role only + app-level filters**: Faster to ship, but materially weaker because a single missing filter can expose cross-user data.
- **Hybrid without RLS**: Better than anonymous scoping, but still allows bypass risk through privileged code paths.

### 2) Split Supabase access into user-context client and admin client

**Decision:**
- Use a per-request Supabase client initialized with the caller's bearer JWT for user-scoped reads/writes.
- Keep a dedicated service-role client only for explicit privileged/internal operations.

**Rationale:** Preserves least privilege on user paths while retaining operational flexibility.

**Alternatives considered:**
- **Single service-role client everywhere**: Simpler but defeats RLS guarantees for user requests.
- **No service-role at all**: Strongest isolation but impractical for some internal/admin tasks.

### 3) Enforce API authentication in Nest with Supabase JWT verification

**Decision:** Add an auth module with bearer-token guard that validates Supabase access tokens (issuer/audience/JWKS) and injects authenticated user context into request handling.

**Rationale:** Resource-server verification is stable, key-rotation-safe, and avoids trusting unauthenticated request payload fields.

**Alternatives considered:**
- **Opaque token trust from frontend**: Insufficient security.
- **Cookie-only backend auth**: Viable but less aligned with the current direct API calling pattern.

### 4) Keep direct browser -> Nest API calls with bearer tokens

**Decision:** Frontend continues calling Nest directly, using an auth-aware API client that attaches current access token.

**Rationale:** Maintains a clear architecture and avoids introducing a mandatory BFF proxy layer for standard API paths.

**Alternatives considered:**
- **Full Next.js BFF proxy**: Simplifies cookie/session forwarding but adds extra complexity and another runtime hop for all APIs.

### 5) Replace `EventSource` with authenticated streaming client

**Decision:** Migrate runtime event streaming to a fetch-based stream client that supports auth headers.

**Rationale:** Browser `EventSource` does not support custom authorization headers, which is incompatible with robust bearer-token protection.

**Alternatives considered:**
- **Token in query string**: Weak security posture and leak risk via logs/history.
- **Unauthenticated stream endpoint**: Unacceptable for user-scoped data.

### 6) Route strategy: public `/`, auth routes, protected `/app`

**Decision:**
- `/` becomes a marketing landing page.
- Auth flows live under `/auth/*` (sign-in/sign-up/recovery/callback/reset states).
- Application UI moves to `/app` and requires authenticated session.

**Rationale:** Clean separation of acquisition UX and authenticated product experience.

**Alternatives considered:**
- **Single page toggle state on `/`**: Harder to reason about access control and SEO behavior.

### 7) Use Supabase-native auth flows and provider setup

**Decision:** Implement OAuth (Google, Azure/Microsoft, Apple) and email/password/recovery flows using Supabase-supported auth patterns and redirect allowlists.

**Rationale:** Avoid custom auth protocol logic and reduce security risk.

**Alternatives considered:**
- **Custom auth orchestration**: Higher maintenance and failure risk for no product gain.

### 8) Use hard cutover migration with legacy cleanup

**Decision:** Perform a single cutover to authenticated ownership, purge legacy anonymous development records as needed, and remove legacy `client_id` contracts instead of maintaining compatibility bridges.

**Rationale:** There are no active production users, so direct cleanup yields a simpler and safer long-term architecture with less transitional complexity.

**Alternatives considered:**
- **Two-phase compatibility migration**: More continuity-focused, but unnecessary for current development-only state and creates avoidable temporary complexity.

### 9) Do not gate app access on email verification in current phase

**Decision:** Do not require verified email as a condition for `/app` access during this development phase, while keeping verification flows available for future tightening.

**Rationale:** Prioritizes implementation momentum and developer iteration while preserving a clear future-hardening path.

**Alternatives considered:**
- **Require verified email now**: Stronger identity assurance, but additional friction and setup not needed for current phase.

### 10) Derive ownership inside SQL boundary and harden RLS policy posture

**Decision:**
- Runtime SQL/RPC mutation paths derive effective user ownership from `auth.uid()` inside database logic.
- SQL function execute privileges are constrained to intended roles.
- User-owned tables use forced RLS and policy expressions optimized for Supabase/Postgres recommendations.

**Rationale:** Prevents caller-forged ownership claims and improves RLS performance/defense-in-depth under scale.

**Alternatives considered:**
- **Trusting caller-provided `user_id` in RPC args**: simpler plumbing, but unacceptable authorization risk.
- **Keeping permissive default function execute privileges**: higher exposure surface than needed.

## Risks / Trade-offs

- **[Auth scope creep across modules]** → Mitigation: centralize request auth context and remove `clientId` fields from public contracts in one coordinated pass.
- **[RLS policy mistakes can block valid traffic or leak data]** → Mitigation: policy-by-policy tests for allow/deny cases and staged rollout with verification queries.
- **[Streaming regressions during `EventSource` migration]** → Mitigation: implement compatibility abstraction in frontend runtime client and add integration tests for reconnect/cursor behavior.
- **[Hard-cutover data purge is irreversible]** → Mitigation: take an optional pre-migration snapshot/export before destructive cleanup, even in development.
- **[OAuth provider setup/config drift between environments]** → Mitigation: documented environment matrix and startup validation for required redirect/provider settings.
- **[Service-role misuse over time]** → Mitigation: hard boundaries in code (separate providers/modules), lint/test checks around prohibited usage in user-path repositories.

## Migration Plan

1. **Foundation migration (DB + contracts)**
- Add/normalize `user_id` columns where required and backfill strategy scaffolding.
- Add RLS policies for user-owned read/write constraints.
- Update RPCs/functions to accept authenticated ownership context instead of `client_id`.

2. **Legacy cleanup and hard cutover**
- Purge legacy anonymous development records where needed.
- Remove deprecated `client_id` ownership columns/contracts/indexes and legacy anonymous API semantics.

3. **Backend auth integration**
- Introduce Nest auth guard + request principal context.
- Convert controller DTOs and service signatures from `clientId` to authenticated user context.
- Update repositories to use user-context Supabase client for user data paths.

4. **Frontend auth + routing**
- Add Supabase SSR auth clients/helpers and auth pages.
- Move app UI to `/app` and enforce protected route checks.
- Replace unauthenticated `EventSource` path with authenticated streaming client.
- Keep authenticated app access available without strict verified-email gating in this phase.

5. **Verification + rollout**
- Expand e2e/integration coverage for auth, protected routing, RLS behavior, and streaming.
- Validate OAuth provider configuration and redirect/callback paths for local development only.

### Rollback Strategy
- Keep rollback-safe migration ordering as much as possible, but treat hard-cutover cleanup as intentionally destructive.
- If regressions occur:
  - revert frontend routing/auth gate deploy,
  - disable newly enforced backend auth guard via feature flag only where necessary,
  - restore data only from pre-migration snapshot/export if cleanup already ran.

## Open Questions

- None blocking for this change.
- Future improvement: require verified email for full app access once environment and onboarding policy are productionized.
- Future improvement: expand redirect/callback allowlists beyond local when staging and production environments are introduced.
