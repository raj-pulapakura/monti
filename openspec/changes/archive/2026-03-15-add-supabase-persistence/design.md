## Context

The current backend orchestrates LLM generation/refinement and returns structured payloads, but it does not persist canonical experience data. The frontend keeps only local browser history, which is not durable across devices and is not suitable for backend observability or future collaboration features.

This change introduces Supabase-backed persistence in the NestJS backend without authentication. The project already uses a clear service/module architecture, so persistence should be integrated as a module plus repository/service layer rather than ad hoc calls in controllers.

## Goals / Non-Goals

**Goals:**
- Add a dedicated Supabase NestJS module that initializes and exports a typed Supabase client.
- Persist successful generation/refinement outputs to Postgres tables with version lineage.
- Store operational run metadata for debugging and tracing generation behavior.
- Add required environment variables to `backend/.env.example` and document setup.
- Support anonymous/client-scoped persistence for MVP (no auth dependency).

**Non-Goals:**
- Implement user authentication, per-user authorization, or RLS policy design for authenticated users.
- Implement full retrieval/search APIs across all persistence tables.
- Replace existing frontend local-storage history in this change.
- Implement asset upload/storage pipelines.

## Decisions

### 1) Use three-table MVP persistence core (`experiences`, `experience_versions`, `generation_runs`)
- **Decision:** Start with the normalized core tables from the proposed schema, and defer `experience_messages` and `experience_assets`.
- **Rationale:** It is enough for durable history, version lineage, and backend observability while keeping implementation scope controlled.
- **Alternative considered:** Single denormalized table for all generations.
  - **Why not chosen:** Harder to evolve for versioning and run-level observability.

### 2) Add a dedicated `SupabaseModule` and provider token
- **Decision:** Create `SupabaseModule` that provides a singleton Supabase client and a small config service.
- **Rationale:** Keeps external dependency wiring isolated and testable, and avoids leaking env handling into domain services.
- **Alternative considered:** Instantiate Supabase client directly inside orchestrator service.
  - **Why not chosen:** Couples orchestration to infra concerns and complicates testing/mocking.

### 3) Persistence is a post-generation/refinement side effect
- **Decision:** On successful payload validation/safety checks, write persistence records. If persistence fails, return a structured server error (fail closed).
- **Rationale:** Prevents divergence between delivered artifact and durable system state in MVP.
- **Alternative considered:** Best-effort persistence with warning logs only.
  - **Why not chosen:** Inconsistent state would make history and debugging unreliable.

### 4) Anonymous scoping via `client_id` (no auth)
- **Decision:** Store a required `client_id` on `experiences` and propagate it on writes.
- **Rationale:** Enables partitioned history before auth exists.
- **Alternative considered:** Completely global experiences with no client partition key.
  - **Why not chosen:** Makes later migration to user/client scoping noisier and less safe.

### 5) Schema lifecycle handled by Supabase migrations
- **Decision:** Add SQL migration under `supabase/migrations/` and run via `supabase db push`.
- **Rationale:** Reproducible environments and clear schema diff/audit trail.
- **Alternative considered:** Manual SQL only in dashboard.
  - **Why not chosen:** Prone to drift between local/staging/prod.

## Risks / Trade-offs

- **[Risk] Persistence write path adds latency to generate/refine** → Mitigation: keep writes minimal, indexed, and synchronous only for required records.
- **[Risk] Missing/invalid env values break startup** → Mitigation: validate Supabase URL and service key at module bootstrap.
- **[Risk] No-auth mode risks cross-client data visibility if read APIs are added carelessly** → Mitigation: require explicit client scoping in repository queries and keep read surface minimal in MVP.
- **[Risk] Schema evolution complexity (adding messages/assets later)** → Mitigation: keep normalized IDs and version lineage now to avoid destructive migrations later.

## Migration Plan

1. Add Supabase migration file(s) for core tables, indexes, and triggers.
2. Apply migration to project database (`supabase db push` or SQL editor for hosted-only flow).
3. Add backend Supabase module and configuration/env validation.
4. Add persistence repository/services and integrate into generation/refinement orchestrator success path.
5. Add/update tests for persistence writes and failure behavior.
6. Deploy backend with Supabase env vars present; rollback by reverting code and migration if needed.

## Open Questions

- Should persistence failures fail the request (`fail closed`) or be downgraded to best-effort after initial production feedback?
- Should `generation_runs.input_prompt` store full prompt text or only a hash + summary for privacy/size control?
- Do we need an immediate API endpoint for recent persisted experiences in MVP, or can this remain backend-only until auth/read requirements are finalized?
