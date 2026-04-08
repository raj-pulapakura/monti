-- Declarative schema for experiences app.
-- This snapshot mirrors the active experience/chat runtime migrations through
-- supabase/migrations/20260330000100_persist_usage_telemetry.sql.
-- Billing tables live in z_billing.sql (loads after this file; see that header).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text null,
  latest_version_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create table if not exists public.experience_versions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null unique,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  parent_generation_id uuid null references public.experience_versions(generation_id) on delete set null,
  version_number int not null check (version_number > 0),
  operation text not null check (operation in ('generate', 'refine')),
  prompt_summary text null,
  quality_mode text not null check (quality_mode in ('fast', 'quality')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  max_tokens int not null check (max_tokens > 0),
  description text not null,
  html text not null,
  css text not null,
  js text not null,
  generation_status text not null default 'succeeded' check (
    generation_status in ('pending', 'running', 'succeeded', 'failed')
  ),
  schema_json jsonb null,
  safety_flags jsonb null,
  tokens_in int null,
  tokens_out int null,
  latency_ms int null,
  created_at timestamptz not null default now(),
  constraint experience_versions_unique_exp_version unique (experience_id, version_number)
);

create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  experience_id uuid null references public.experiences(id) on delete set null,
  version_id uuid null references public.experience_versions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('generate', 'refine')),
  provider text null,
  model text null,
  quality_mode text null check (quality_mode in ('fast', 'quality')),
  input_prompt text null,
  output_raw jsonb null,
  attempt_count int not null default 0 check (attempt_count >= 0),
  request_tokens_in int null,
  request_tokens_out int null,
  status text not null default 'created' check (status in ('created', 'running', 'succeeded', 'failed')),
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.experiences
  drop constraint if exists experiences_latest_version_id_fkey;

alter table public.experiences
  add constraint experiences_latest_version_id_fkey
  foreign key (latest_version_id)
  references public.experience_versions(id)
  on delete set null;

create index if not exists idx_experiences_client_id on public.experiences (client_id);
create index if not exists idx_experiences_user_id on public.experiences (user_id);
create index if not exists idx_experiences_slug on public.experiences (slug);

create index if not exists idx_experience_versions_generation_id
  on public.experience_versions (generation_id);
create index if not exists idx_experience_versions_experience_id
  on public.experience_versions (experience_id);
create index if not exists idx_experience_versions_parent_generation_id
  on public.experience_versions (parent_generation_id);
create index if not exists idx_experience_versions_created_at
  on public.experience_versions (created_at);
create index if not exists idx_experience_versions_generation_status
  on public.experience_versions (generation_status);
create index if not exists idx_experience_versions_expid_status_createdat_desc
  on public.experience_versions (experience_id, created_at desc)
  where generation_status = 'succeeded';

create index if not exists idx_generation_runs_request_id on public.generation_runs (request_id);
create index if not exists idx_generation_runs_experience_id on public.generation_runs (experience_id);
create index if not exists idx_generation_runs_version_id on public.generation_runs (version_id);
create index if not exists idx_generation_runs_status on public.generation_runs (status);
create index if not exists idx_generation_runs_created_at on public.generation_runs (created_at);
create index if not exists idx_generation_runs_user_id_created_at_desc
  on public.generation_runs (user_id, created_at desc);

create or replace function public._set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_experiences_updated_at on public.experiences;
create trigger trg_experiences_updated_at
before update on public.experiences
for each row execute function public._set_updated_at();

create or replace function public._experiences_set_latest_version()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and (new.generation_status = 'succeeded') then
    update public.experiences e
    set latest_version_id = new.id,
        updated_at = now()
    where e.id = new.experience_id
      and (
        e.latest_version_id is null
        or (
          select version_number
          from public.experience_versions
          where id = e.latest_version_id
        ) < new.version_number
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_experience_versions_set_latest on public.experience_versions;
create trigger trg_experience_versions_set_latest
after insert or update of generation_status, version_number
on public.experience_versions
for each row execute function public._experiences_set_latest_version();

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  conversation_provider text null check (conversation_provider in ('openai', 'anthropic', 'gemini')),
  conversation_model text null,
  provider text null check (provider in ('openai', 'anthropic', 'gemini')),
  model text null,
  provider_request_raw jsonb null,
  provider_response_raw jsonb null,
  conversation_tokens_in int null,
  conversation_tokens_out int null,
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
  generation_id text null,
  experience_id uuid null references public.experiences(id) on delete set null,
  experience_version_id uuid null references public.experience_versions(id) on delete set null,
  router_tier text null check (router_tier in ('fast', 'quality')),
  router_confidence numeric(5,4) null check (router_confidence >= 0 and router_confidence <= 1),
  router_reason text null,
  router_fallback_reason text null,
  router_provider text null check (router_provider in ('openai', 'anthropic', 'gemini')),
  router_model text null,
  router_request_raw jsonb null,
  router_response_raw jsonb null,
  router_tokens_in int null,
  router_tokens_out int null,
  selected_provider text null check (selected_provider in ('openai', 'anthropic', 'gemini')),
  selected_model text null,
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

create index if not exists idx_chat_threads_user_id_updated_at_desc
  on public.chat_threads (user_id, updated_at desc);

create index if not exists idx_chat_messages_thread_id_created_at
  on public.chat_messages (thread_id, created_at);
create index if not exists idx_chat_messages_role on public.chat_messages (role);
create index if not exists idx_chat_messages_user_id_thread_created_at
  on public.chat_messages (user_id, thread_id, created_at);
create unique index if not exists idx_chat_messages_thread_idempotency
  on public.chat_messages (thread_id, idempotency_key)
  where idempotency_key is not null and role = 'user';

create index if not exists idx_assistant_runs_thread_id_created_at
  on public.assistant_runs (thread_id, created_at);
create index if not exists idx_assistant_runs_status on public.assistant_runs (status);
create index if not exists idx_assistant_runs_provider on public.assistant_runs (provider);
create index if not exists idx_assistant_runs_conversation_provider
  on public.assistant_runs (conversation_provider);
create unique index if not exists idx_assistant_runs_single_active_per_thread
  on public.assistant_runs (thread_id)
  where status in ('queued', 'running');

create index if not exists idx_tool_invocations_run_id_created_at
  on public.tool_invocations (run_id, created_at);
create index if not exists idx_tool_invocations_thread_id on public.tool_invocations (thread_id);
create index if not exists idx_tool_invocations_status on public.tool_invocations (status);
create index if not exists idx_tool_invocations_provider_call_id
  on public.tool_invocations (provider_tool_call_id);
create index if not exists idx_tool_invocations_generation_id
  on public.tool_invocations (generation_id);
create index if not exists idx_tool_invocations_experience_version_id
  on public.tool_invocations (experience_version_id);

create index if not exists idx_sandbox_states_status on public.sandbox_states (status);

drop trigger if exists trg_chat_threads_updated_at on public.chat_threads;
create trigger trg_chat_threads_updated_at
before update on public.chat_threads
for each row execute function public._set_updated_at();

drop trigger if exists trg_sandbox_states_updated_at on public.sandbox_states;
create trigger trg_sandbox_states_updated_at
before update on public.sandbox_states
for each row execute function public._set_updated_at();

create or replace function public.chat_submit_user_message(
  p_thread_id uuid,
  p_user_id uuid,
  p_content text,
  p_idempotency_key text default null
)
returns table(
  message_id uuid,
  message_created_at timestamptz,
  run_id uuid,
  run_status text,
  deduplicated boolean
)
language plpgsql
security definer
as $$
declare
  v_existing_message_id uuid;
  v_existing_message_created_at timestamptz;
  v_existing_run_id uuid;
  v_existing_run_status text;
  v_message_id uuid;
  v_message_created_at timestamptz;
  v_run_id uuid;
  v_run_status text;
  v_idempotency_key text;
begin
  if p_user_id is null then
    raise exception 'Authenticated user id is required.' using errcode = 'P0001';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'Message content must be non-empty.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.chat_threads
    where id = p_thread_id
      and user_id = p_user_id
  ) then
    raise exception 'Thread not found for authenticated user scope.' using errcode = 'P0001';
  end if;

  v_idempotency_key := nullif(trim(coalesce(p_idempotency_key, '')), '');

  if v_idempotency_key is not null then
    select m.id, m.created_at
    into v_existing_message_id, v_existing_message_created_at
    from public.chat_messages m
    where m.thread_id = p_thread_id
      and m.user_id = p_user_id
      and m.role = 'user'
      and m.idempotency_key = v_idempotency_key
    order by m.created_at desc
    limit 1;

    if v_existing_message_id is not null then
      select r.id, r.status
      into v_existing_run_id, v_existing_run_status
      from public.assistant_runs r
      where r.user_message_id = v_existing_message_id
      order by r.created_at desc
      limit 1;

      message_id := v_existing_message_id;
      message_created_at := v_existing_message_created_at;
      run_id := v_existing_run_id;
      run_status := v_existing_run_status;
      deduplicated := true;
      return next;
      return;
    end if;
  end if;

  insert into public.chat_messages (
    thread_id,
    user_id,
    role,
    content,
    content_json,
    idempotency_key
  )
  values (
    p_thread_id,
    p_user_id,
    'user',
    trim(p_content),
    null,
    v_idempotency_key
  )
  returning id, created_at into v_message_id, v_message_created_at;

  begin
    insert into public.assistant_runs (
      thread_id,
      user_message_id,
      status,
      created_at
    )
    values (
      p_thread_id,
      v_message_id,
      'queued',
      now()
    )
    returning id, status into v_run_id, v_run_status;
  exception
    when unique_violation then
      raise exception 'An assistant run is already queued or running for this thread.'
      using errcode = 'P0001';
  end;

  update public.chat_threads
  set updated_at = now()
  where id = p_thread_id;

  insert into public.sandbox_states (thread_id, status, updated_at)
  values (p_thread_id, 'empty', now())
  on conflict (thread_id) do nothing;

  message_id := v_message_id;
  message_created_at := v_message_created_at;
  run_id := v_run_id;
  run_status := v_run_status;
  deduplicated := false;
  return next;
end;
$$;
