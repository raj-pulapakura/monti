-- Chat-first runtime schema for thread/message/run/tool orchestration.

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  client_id text not null,
  title text null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  client_id text not null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null,
  content_json jsonb null,
  idempotency_key text null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_message_id uuid not null references public.chat_messages(id) on delete cascade,
  assistant_message_id uuid null references public.chat_messages(id) on delete set null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  router_tier text null check (router_tier in ('fast', 'quality')),
  router_provider_hint text null check (router_provider_hint in ('openai', 'anthropic', 'gemini')),
  router_confidence numeric(5,4) null check (router_confidence >= 0 and router_confidence <= 1),
  router_reason text null,
  router_fallback_reason text null,
  provider text null check (provider in ('openai', 'anthropic', 'gemini')),
  model text null,
  error_code text null,
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint assistant_runs_user_message_unique unique (user_message_id)
);

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  run_id uuid not null references public.assistant_runs(id) on delete cascade,
  provider_tool_call_id text null,
  tool_name text not null,
  tool_arguments jsonb not null default '{}'::jsonb,
  tool_result jsonb null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'succeeded', 'failed')
  ),
  error_code text null,
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.sandbox_states (
  thread_id uuid primary key references public.chat_threads(id) on delete cascade,
  status text not null default 'empty' check (status in ('empty', 'creating', 'ready', 'error')),
  experience_id uuid null references public.experiences(id) on delete set null,
  experience_version_id uuid null references public.experience_versions(id) on delete set null,
  last_error_code text null,
  last_error_message text null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_threads_client_id on public.chat_threads (client_id);
create index if not exists idx_chat_threads_updated_at on public.chat_threads (updated_at desc);

create index if not exists idx_chat_messages_thread_id_created_at
  on public.chat_messages (thread_id, created_at);
create index if not exists idx_chat_messages_role on public.chat_messages (role);
create unique index if not exists idx_chat_messages_thread_idempotency
  on public.chat_messages (thread_id, idempotency_key)
  where idempotency_key is not null and role = 'user';

create index if not exists idx_assistant_runs_thread_id_created_at
  on public.assistant_runs (thread_id, created_at);
create index if not exists idx_assistant_runs_status on public.assistant_runs (status);
create index if not exists idx_assistant_runs_provider on public.assistant_runs (provider);

create index if not exists idx_tool_invocations_run_id_created_at
  on public.tool_invocations (run_id, created_at);
create index if not exists idx_tool_invocations_thread_id on public.tool_invocations (thread_id);
create index if not exists idx_tool_invocations_status on public.tool_invocations (status);
create index if not exists idx_tool_invocations_provider_call_id
  on public.tool_invocations (provider_tool_call_id);

create index if not exists idx_sandbox_states_status on public.sandbox_states (status);

-- Reuse existing shared trigger helper.
drop trigger if exists trg_chat_threads_updated_at on public.chat_threads;
create trigger trg_chat_threads_updated_at
before update on public.chat_threads
for each row execute function public._set_updated_at();

drop trigger if exists trg_sandbox_states_updated_at on public.sandbox_states;
create trigger trg_sandbox_states_updated_at
before update on public.sandbox_states
for each row execute function public._set_updated_at();
