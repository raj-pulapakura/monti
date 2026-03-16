-- Hard cutover from anonymous client-scoped persistence to authenticated user-scoped ownership.

truncate table public.tool_invocations,
  public.assistant_runs,
  public.chat_messages,
  public.sandbox_states,
  public.chat_threads,
  public.generation_runs,
  public.experience_versions,
  public.experiences
restart identity cascade;

-- Experiences
drop index if exists public.idx_experiences_client_id;

alter table public.experiences
  alter column user_id set not null,
  drop column if exists client_id;

alter table public.experiences
  drop constraint if exists experiences_user_id_fkey;

alter table public.experiences
  add constraint experiences_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists idx_experiences_user_id_created_at_desc
  on public.experiences (user_id, created_at desc);

-- Generation runs
drop index if exists public.idx_generation_runs_client_id;

alter table public.generation_runs
  add column if not exists user_id uuid;

alter table public.generation_runs
  alter column user_id set not null,
  drop column if exists client_id;

alter table public.generation_runs
  drop constraint if exists generation_runs_user_id_fkey;

alter table public.generation_runs
  add constraint generation_runs_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists idx_generation_runs_user_id_created_at_desc
  on public.generation_runs (user_id, created_at desc);

-- Chat threads
drop index if exists public.idx_chat_threads_client_id;

alter table public.chat_threads
  alter column user_id set not null,
  drop column if exists client_id;

alter table public.chat_threads
  drop constraint if exists chat_threads_user_id_fkey;

alter table public.chat_threads
  add constraint chat_threads_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists idx_chat_threads_user_id_updated_at_desc
  on public.chat_threads (user_id, updated_at desc);

-- Chat messages
alter table public.chat_messages
  add column if not exists user_id uuid;

alter table public.chat_messages
  alter column user_id set not null,
  drop column if exists client_id;

alter table public.chat_messages
  drop constraint if exists chat_messages_user_id_fkey;

alter table public.chat_messages
  add constraint chat_messages_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

create index if not exists idx_chat_messages_user_id_thread_created_at
  on public.chat_messages (user_id, thread_id, created_at);

-- Chat submit RPC now enforces authenticated user ownership.
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

-- Enable row-level security for authenticated ownership.
alter table public.experiences enable row level security;
alter table public.experience_versions enable row level security;
alter table public.generation_runs enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.sandbox_states enable row level security;

drop policy if exists experiences_owner_select on public.experiences;
drop policy if exists experiences_owner_insert on public.experiences;
drop policy if exists experiences_owner_update on public.experiences;
drop policy if exists experiences_owner_delete on public.experiences;

create policy experiences_owner_select on public.experiences
for select using (user_id = auth.uid());
create policy experiences_owner_insert on public.experiences
for insert with check (user_id = auth.uid());
create policy experiences_owner_update on public.experiences
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy experiences_owner_delete on public.experiences
for delete using (user_id = auth.uid());

drop policy if exists experience_versions_owner_select on public.experience_versions;
drop policy if exists experience_versions_owner_insert on public.experience_versions;
drop policy if exists experience_versions_owner_update on public.experience_versions;
drop policy if exists experience_versions_owner_delete on public.experience_versions;

create policy experience_versions_owner_select on public.experience_versions
for select using (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_versions.experience_id
      and e.user_id = auth.uid()
  )
);

create policy experience_versions_owner_insert on public.experience_versions
for insert with check (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_versions.experience_id
      and e.user_id = auth.uid()
  )
);

create policy experience_versions_owner_update on public.experience_versions
for update using (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_versions.experience_id
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_versions.experience_id
      and e.user_id = auth.uid()
  )
);

create policy experience_versions_owner_delete on public.experience_versions
for delete using (
  exists (
    select 1
    from public.experiences e
    where e.id = experience_versions.experience_id
      and e.user_id = auth.uid()
  )
);

drop policy if exists generation_runs_owner_select on public.generation_runs;
drop policy if exists generation_runs_owner_insert on public.generation_runs;
drop policy if exists generation_runs_owner_update on public.generation_runs;
drop policy if exists generation_runs_owner_delete on public.generation_runs;

create policy generation_runs_owner_select on public.generation_runs
for select using (user_id = auth.uid());
create policy generation_runs_owner_insert on public.generation_runs
for insert with check (user_id = auth.uid());
create policy generation_runs_owner_update on public.generation_runs
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy generation_runs_owner_delete on public.generation_runs
for delete using (user_id = auth.uid());

drop policy if exists chat_threads_owner_select on public.chat_threads;
drop policy if exists chat_threads_owner_insert on public.chat_threads;
drop policy if exists chat_threads_owner_update on public.chat_threads;
drop policy if exists chat_threads_owner_delete on public.chat_threads;

create policy chat_threads_owner_select on public.chat_threads
for select using (user_id = auth.uid());
create policy chat_threads_owner_insert on public.chat_threads
for insert with check (user_id = auth.uid());
create policy chat_threads_owner_update on public.chat_threads
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_threads_owner_delete on public.chat_threads
for delete using (user_id = auth.uid());

drop policy if exists chat_messages_owner_select on public.chat_messages;
drop policy if exists chat_messages_owner_insert on public.chat_messages;
drop policy if exists chat_messages_owner_update on public.chat_messages;
drop policy if exists chat_messages_owner_delete on public.chat_messages;

create policy chat_messages_owner_select on public.chat_messages
for select using (user_id = auth.uid());
create policy chat_messages_owner_insert on public.chat_messages
for insert with check (user_id = auth.uid());
create policy chat_messages_owner_update on public.chat_messages
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_messages_owner_delete on public.chat_messages
for delete using (user_id = auth.uid());

drop policy if exists assistant_runs_owner_select on public.assistant_runs;
drop policy if exists assistant_runs_owner_insert on public.assistant_runs;
drop policy if exists assistant_runs_owner_update on public.assistant_runs;
drop policy if exists assistant_runs_owner_delete on public.assistant_runs;

create policy assistant_runs_owner_select on public.assistant_runs
for select using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = assistant_runs.thread_id
      and t.user_id = auth.uid()
  )
);

create policy assistant_runs_owner_insert on public.assistant_runs
for insert with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = assistant_runs.thread_id
      and t.user_id = auth.uid()
  )
);

create policy assistant_runs_owner_update on public.assistant_runs
for update using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = assistant_runs.thread_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = assistant_runs.thread_id
      and t.user_id = auth.uid()
  )
);

create policy assistant_runs_owner_delete on public.assistant_runs
for delete using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = assistant_runs.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists tool_invocations_owner_select on public.tool_invocations;
drop policy if exists tool_invocations_owner_insert on public.tool_invocations;
drop policy if exists tool_invocations_owner_update on public.tool_invocations;
drop policy if exists tool_invocations_owner_delete on public.tool_invocations;

create policy tool_invocations_owner_select on public.tool_invocations
for select using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = tool_invocations.thread_id
      and t.user_id = auth.uid()
  )
);

create policy tool_invocations_owner_insert on public.tool_invocations
for insert with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = tool_invocations.thread_id
      and t.user_id = auth.uid()
  )
);

create policy tool_invocations_owner_update on public.tool_invocations
for update using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = tool_invocations.thread_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = tool_invocations.thread_id
      and t.user_id = auth.uid()
  )
);

create policy tool_invocations_owner_delete on public.tool_invocations
for delete using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = tool_invocations.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists sandbox_states_owner_select on public.sandbox_states;
drop policy if exists sandbox_states_owner_insert on public.sandbox_states;
drop policy if exists sandbox_states_owner_update on public.sandbox_states;
drop policy if exists sandbox_states_owner_delete on public.sandbox_states;

create policy sandbox_states_owner_select on public.sandbox_states
for select using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = sandbox_states.thread_id
      and t.user_id = auth.uid()
  )
);

create policy sandbox_states_owner_insert on public.sandbox_states
for insert with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = sandbox_states.thread_id
      and t.user_id = auth.uid()
  )
);

create policy sandbox_states_owner_update on public.sandbox_states
for update using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = sandbox_states.thread_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = sandbox_states.thread_id
      and t.user_id = auth.uid()
  )
);

create policy sandbox_states_owner_delete on public.sandbox_states
for delete using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = sandbox_states.thread_id
      and t.user_id = auth.uid()
  )
);
