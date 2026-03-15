## 1. Supabase schema and migration setup

- [x] 1.1 Initialize `supabase/` project scaffolding in the repository (if missing) and add migration structure.
- [x] 1.2 Add migration SQL for `experiences`, `experience_versions`, and `generation_runs` tables with primary keys, foreign keys, and constraints.
- [x] 1.3 Add indexes and helper triggers/functions (for `updated_at` and `latest_version_id` sync) and validate migration applies cleanly.

## 2. Backend Supabase module and configuration

- [x] 2.1 Add runtime dependency for Supabase client SDK in backend and ensure dependency placement is correct for production builds.
- [x] 2.2 Create `SupabaseModule` with a provider token that exposes a singleton typed Supabase client.
- [x] 2.3 Add backend config validation for Supabase URL/service-role key and wire module into `AppModule`.

## 3. Persistence domain layer

- [x] 3.1 Create persistence repository/service abstractions for creating experiences, inserting versions, and recording generation runs.
- [x] 3.2 Implement version numbering and lineage linking (`parent`/latest version updates) in persistence logic.
- [x] 3.3 Implement anonymous client scoping (`client_id`) validation and mapping for persistence writes.

## 4. Generation/refinement integration

- [x] 4.1 Update generation flow to persist successful outputs and associated run metadata after validation/safety checks.
- [x] 4.2 Update refinement flow to persist new linked versions and associated run metadata.
- [x] 4.3 Record failed run metadata consistently for provider/validation/safety failures.

## 5. API contract and environment updates

- [x] 5.1 Extend request DTOs/contracts as needed to accept/derive client-scoping identifier for persistence writes.
- [x] 5.2 Update `backend/.env.example` with required Supabase variables and keep non-sensitive defaults/documentation clear.
- [x] 5.3 Update backend README/docs with Supabase setup and migration/apply instructions.

## 6. Verification and tests

- [x] 6.1 Add unit tests for persistence services (success path, constraint/validation failures, version progression).
- [x] 6.2 Add orchestrator tests ensuring generate/refine persistence side effects and failure behavior.
- [x] 6.3 Run backend test suite and smoke-check generate/refine endpoints with Supabase-backed persistence enabled.
