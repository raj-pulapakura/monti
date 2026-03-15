-- Core persistence schema for Monti MVP experience generation and refinement.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  client_id text not null,
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
  format text null check (format in ('quiz', 'game', 'explainer')),
  audience text null check (audience in ('young-kids', 'elementary', 'middle-school')),
  quality_mode text not null check (quality_mode in ('fast', 'quality')),
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  max_tokens int not null check (max_tokens > 0),
  title text not null,
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
  client_id text not null,
  operation text not null check (operation in ('generate', 'refine')),
  provider text null,
  model text null,
  quality_mode text null check (quality_mode in ('fast', 'quality')),
  input_prompt text null,
  output_raw jsonb null,
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
create index if not exists idx_generation_runs_client_id on public.generation_runs (client_id);
create index if not exists idx_generation_runs_status on public.generation_runs (status);
create index if not exists idx_generation_runs_created_at on public.generation_runs (created_at);

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
