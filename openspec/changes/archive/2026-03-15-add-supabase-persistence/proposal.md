## Why

Monti currently generates and refines experiences but does not persist canonical data in the backend. We need durable storage now to support recovery, auditability, and future multi-device history, and Supabase gives us a managed Postgres target that fits the current stack.

## What Changes

- Add a backend Supabase integration module in NestJS that provides a configured Supabase client and startup-time configuration validation.
- Introduce backend persistence services/repositories for storing generated and refined experiences in Postgres-backed Supabase tables.
- Persist successful `generate` and `refine` outcomes as versioned records, with enough metadata to trace model/provider/runtime behavior.
- Add initial database schema for `experiences`, `experience_versions`, and `generation_runs` with indexes and helper triggers for latest-version tracking.
- Add required Supabase environment variables to `backend/.env.example` and update backend documentation for local/dev setup.
- Keep auth out of scope for this change; persistence should work with anonymous/client-scoped identifiers.

## Capabilities

### New Capabilities
- `experience-persistence`: Backend persistence model and lifecycle for storing experiences, versions, and generation runs in Supabase Postgres.

### Modified Capabilities
- `experience-generation`: successful generation now has a persistence side effect that stores the resulting artifact and metadata.
- `experience-refinement`: successful refinement now has a persistence side effect that stores the new version and links lineage.

## Impact

- Affected code: `backend/src/app.module.ts`, new `backend/src/supabase/*`, `backend/src/experience/services/*` orchestration/repository wiring, and related tests.
- Affected configuration: `backend/.env.example` and backend runtime environment setup.
- New artifacts: Supabase SQL schema/migration files under a `supabase/` project directory.
- External dependency usage: existing `supabase` npm dependency is wired into runtime.
