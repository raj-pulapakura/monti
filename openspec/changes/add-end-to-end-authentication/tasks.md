## 1. Supabase And Identity Control Plane Setup

- [ ] 1.1 Confirm Supabase project URL/ref and obtain local development credentials (anon key and service role key)
- [ ] 1.2 In Supabase Auth URL configuration, set `Site URL` to `http://localhost:3000`
- [ ] 1.3 Add local redirect allow-list entries for auth callback and recovery routes (at minimum `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/reset-password`)
- [ ] 1.4 Enable Email provider in Supabase Auth and ensure email/password sign-up and sign-in are enabled
- [ ] 1.5 Configure current-phase policy so unverified email users are not blocked from `/app` access (keep verification capability available for later hardening)
- [ ] 1.6 Verify recovery/confirmation email templates and redirect targets point to local auth routes
- [ ] 1.7 Enable Google provider in Supabase and set Google OAuth client ID/secret
- [ ] 1.8 In Google Cloud OAuth configuration, set authorized redirect URI to `<SUPABASE_URL>/auth/v1/callback` and local web origin to `http://localhost:3000`
- [ ] 1.9 Enable Microsoft (Azure) provider in Supabase and set Azure app client ID/secret and tenant settings
- [ ] 1.10 In Azure App Registration, configure redirect URI to `<SUPABASE_URL>/auth/v1/callback` and app registration account type for local testing
- [ ] 1.11 Enable Apple provider in Supabase and set Apple credentials (Services ID/client ID, Team ID, Key ID, private key)
- [ ] 1.12 In Apple Developer, configure Sign in with Apple return URL to `<SUPABASE_URL>/auth/v1/callback` and complete required key setup
- [ ] 1.13 Add/verify local web and backend env values (`SUPABASE_URL`, anon key, service role key, JWT issuer/audience, local callback URLs)
- [ ] 1.14 Validate Google, Microsoft, Apple, and email/password sign-in plus password recovery in local before code migration begins
- [x] 1.15 Create migration to add/normalize `user_id` ownership columns across runtime and persistence tables where required
- [x] 1.16 Create migration to add indexes/constraints supporting `user_id`-scoped lookups and idempotency behavior
- [x] 1.17 Create migration to update RPC/function signatures and ownership checks from `client_id` scope to authenticated user scope
- [x] 1.18 Enable RLS on user-scoped tables and add owner-only read/write policies
- [x] 1.19 Purge legacy anonymous development records and remove legacy `client_id` ownership columns/contracts/indexes

## 2. Backend JWT Authentication Infrastructure (Nest)

- [x] 2.1 Add backend auth module with Supabase JWT verification utilities (JWKS/claim validation)
- [x] 2.2 Implement `AuthGuard` and request principal extraction for authenticated `user_id` context
- [x] 2.3 Wire auth module into app bootstrap/module graph and protect required API controllers
- [x] 2.4 Add typed auth request context helpers/decorators for controller and service layers
- [x] 2.5 Add dedicated separation between user-context Supabase client and service-role admin client providers

## 3. Backend Runtime And Persistence Contract Migration

- [x] 3.1 Remove `clientId` from chat runtime DTOs and controller contracts
- [x] 3.2 Refactor chat runtime service/repository APIs to consume authenticated `user_id` context
- [x] 3.3 Update chat thread ownership checks, hydration, message submission, sandbox preview, and event stream scoping to user ownership
- [x] 3.4 Update idempotent submit logic to enforce user-scoped idempotency semantics
- [x] 3.5 Refactor experience persistence service/repository contracts from `client_id` to `user_id`
- [x] 3.6 Ensure generation/refinement telemetry records retain user ownership linkage
- [x] 3.7 Remove or deprecate anonymous ownership logic paths no longer valid under authenticated model

## 4. Frontend Auth Flows And Route Segmentation (Next.js)

- [x] 4.1 Add Supabase SSR auth clients/helpers for browser and server route usage
- [x] 4.2 Implement public landing page at `/` with marketing content
- [x] 4.3 Move current application UI to `/app` route and preserve runtime functionality
- [x] 4.4 Implement auth routes under `/auth/*` for sign-in, sign-up, forgot-password, reset-password, and auth callback handling
- [x] 4.5 Add OAuth actions for Google, Microsoft, and Apple providers with configured redirect behavior
- [x] 4.6 Add email/password sign-up and sign-in form flows with validation and error states
- [x] 4.7 Implement session-aware redirects (unauthenticated -> `/auth/sign-in`, authenticated auth-page access -> `/app`)
- [x] 4.8 Implement sign-out behavior and authenticated navigation state updates
- [x] 4.9 Keep authenticated app access available for unverified-email users in the current development phase

## 5. Authenticated API And Streaming Client Migration

- [x] 5.1 Build frontend API client wrapper that attaches bearer access token to backend requests
- [x] 5.2 Remove frontend dependence on anonymous `clientId` ownership in runtime calls
- [x] 5.3 Replace `EventSource` runtime stream path with authenticated fetch-based streaming client
- [x] 5.4 Update runtime state bootstrapping to use authenticated thread lifecycle semantics
- [x] 5.5 Validate reconnect/cursor behavior under authenticated streaming

## 6. Migration, Testing, And Rollout Verification

- [x] 6.1 Add backend unit/integration tests for JWT guard behavior (missing, invalid, expired, valid tokens)
- [x] 6.2 Add repository/service tests for cross-user access denial and owner-only access success
- [ ] 6.3 Add tests covering RLS policy behavior for user-owned runtime and persistence records
- [x] 6.4 Add web tests for route protection, auth flow screens, and sign-out redirects
- [ ] 6.5 Add end-to-end tests for OAuth/email-password auth flows and protected `/app` access
- [ ] 6.6 Add end-to-end tests for authenticated runtime streaming and idempotent message submission
- [ ] 6.7 Validate local-only provider config and local redirect/callback URLs for OAuth and recovery flows
- [x] 6.8 Record future hardening backlog item to require verified email for full app access in production phase

## 7. Manual QA Checklist

- [ ] 7.1 Verify unauthenticated visitor sees landing page at `/` and is redirected to sign-in when requesting `/app`
- [ ] 7.2 Verify sign-in and first app access succeeds for each OAuth provider (Google, Microsoft, Apple)
- [ ] 7.3 Verify email/password sign-up and sign-in succeed and allow `/app` access in current phase without verified-email gating
- [ ] 7.4 Verify forgot-password and reset-password flow completes end-to-end using local redirect routes
- [ ] 7.5 Verify authenticated user can create/use chat thread runtime and receive live runtime updates in `/app`
- [ ] 7.6 Verify sign-out immediately revokes protected route access and backend API calls without re-authentication
- [ ] 7.7 Verify cross-user isolation manually by using two accounts and confirming neither can access the other's threads/artifacts/events
- [ ] 7.8 Verify session persistence and refresh behavior across browser reload and reopen
- [ ] 7.9 Verify authenticated streaming reconnect/cursor behavior works after network interruption
- [ ] 7.10 Verify auth and runtime error states surface actionable UI feedback (invalid credentials, expired link, unauthorized API)
