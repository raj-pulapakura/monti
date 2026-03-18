## Why

Monti currently runs as an anonymous single-tenant client experience keyed by local `clientId`, which cannot provide reliable user identity, secure cross-device access, or durable access control. We need a production-grade authentication foundation now so all app and persistence paths are user-owned, protected, and auditable across frontend, backend, and database layers.

## What Changes

- Add complete end-user authentication with Supabase Auth for:
  - OAuth providers: Google, Microsoft (Azure), Apple
  - Email/password sign-up and sign-in
  - Password recovery and reset, email confirmation, sign-out, session lifecycle handling
- Introduce web route segmentation:
  - Public marketing landing page at `/`
  - Auth UX pages for sign-in/sign-up and recovery flows
  - Protected application route at `/app`
- Enforce backend API authentication using Supabase JWT access tokens; remove trust in caller-provided anonymous ownership identifiers.
- Move persistence and runtime ownership from `client_id` scoping to authenticated `user_id` ownership.
- Enable and enforce Row Level Security (RLS) policies for user-scoped tables used by chat runtime and experience persistence.
- Replace unauthenticated/anonymous stream assumptions with authenticated streaming behavior for runtime events.
- Perform a hard cutover to the authenticated model, including cleanup/purge of legacy anonymous development data and removal of deprecated contracts.

## Capabilities

### New Capabilities
- `user-authentication`: User account auth lifecycle across OAuth, email/password, recovery/reset, confirmation, session and sign-out behavior.
- `web-public-protected-routing`: Public marketing route, dedicated auth UX routes, and protected app route access control.
- `api-jwt-authentication`: Backend bearer token validation, authenticated request context, and endpoint protection contract.

### Modified Capabilities
- `chat-thread-runtime`: Change thread/message/run ownership and API contracts from anonymous `clientId` scoping to authenticated user scoping.
- `experience-persistence`: Change persistence ownership and access control from client-scoped records to user-scoped records with RLS enforcement.

## Impact

- **Frontend (Next.js)**: New route structure, auth clients/helpers, auth UI flows, protected route middleware/guards, authenticated API and stream clients.
- **Backend (Nest.js)**: New auth module/guards/context, controller contract changes, repository ownership checks updated to user context.
- **Database (Supabase/Postgres)**: New auth-focused migrations, RLS policies, schema ownership updates, RPC and index updates to user scope.
- **Operational**: Supabase provider configuration for Google/Microsoft/Apple in local development, local redirect URL allowlists, auth environment variables, test matrix expansion for auth and scoped access.
