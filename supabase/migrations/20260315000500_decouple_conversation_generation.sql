-- Option A: keep assistant_runs as conversation runs and extend correlation metadata.

alter table public.assistant_runs
  add column if not exists conversation_provider text null check (
    conversation_provider in ('openai', 'anthropic', 'gemini')
  ),
  add column if not exists conversation_model text null;

alter table public.tool_invocations
  add column if not exists generation_id text null,
  add column if not exists experience_id uuid null references public.experiences(id) on delete set null,
  add column if not exists experience_version_id uuid null references public.experience_versions(id) on delete set null,
  add column if not exists router_tier text null check (router_tier in ('fast', 'quality')),
  add column if not exists router_confidence numeric(5,4) null check (router_confidence >= 0 and router_confidence <= 1),
  add column if not exists router_reason text null,
  add column if not exists router_fallback_reason text null,
  add column if not exists selected_provider text null check (selected_provider in ('openai', 'anthropic', 'gemini')),
  add column if not exists selected_model text null;

create index if not exists idx_tool_invocations_generation_id
  on public.tool_invocations (generation_id);
create index if not exists idx_tool_invocations_experience_version_id
  on public.tool_invocations (experience_version_id);
create index if not exists idx_assistant_runs_conversation_provider
  on public.assistant_runs (conversation_provider);

-- Backfill conversation provider/model where old runs were coupled to generation routing.
update public.assistant_runs
set
  conversation_provider = coalesce(conversation_provider, 'openai'),
  conversation_model = coalesce(conversation_model, model)
where conversation_provider is null;
