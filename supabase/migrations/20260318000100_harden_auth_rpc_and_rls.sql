-- Hardening pass for authenticated RPC + RLS policy performance and privilege boundaries.

-- Remove legacy overloaded RPC signatures, then recreate a single invoker-scoped function.
drop function if exists public.chat_submit_user_message(uuid, text, text, text);
drop function if exists public.chat_submit_user_message(uuid, uuid, text, text);

create function public.chat_submit_user_message(
  p_thread_id uuid,
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
security invoker
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
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
  v_auth_user_id := (select auth.uid());

  if v_auth_user_id is null then
    raise exception 'Authenticated user id is required.' using errcode = 'P0001';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'Message content must be non-empty.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.chat_threads
    where id = p_thread_id
      and user_id = v_auth_user_id
  ) then
    raise exception 'Thread not found for authenticated user scope.' using errcode = 'P0001';
  end if;

  v_idempotency_key := nullif(trim(coalesce(p_idempotency_key, '')), '');

  if v_idempotency_key is not null then
    select m.id, m.created_at
    into v_existing_message_id, v_existing_message_created_at
    from public.chat_messages m
    where m.thread_id = p_thread_id
      and m.user_id = v_auth_user_id
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
    v_auth_user_id,
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
      -- Includes idempotency collisions on (thread_id, idempotency_key) and active-run guardrails.
      select m.id, m.created_at
      into v_existing_message_id, v_existing_message_created_at
      from public.chat_messages m
      where m.thread_id = p_thread_id
        and m.user_id = v_auth_user_id
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

revoke all on function public.chat_submit_user_message(uuid, text, text) from public;
grant execute on function public.chat_submit_user_message(uuid, text, text) to authenticated;
grant execute on function public.chat_submit_user_message(uuid, text, text) to service_role;

-- Add missing FK indexes (Postgres does not auto-index FK columns).
create index if not exists idx_experiences_latest_version_id
  on public.experiences (latest_version_id);

create index if not exists idx_assistant_runs_assistant_message_id
  on public.assistant_runs (assistant_message_id);

create index if not exists idx_sandbox_states_experience_id
  on public.sandbox_states (experience_id);

create index if not exists idx_sandbox_states_experience_version_id
  on public.sandbox_states (experience_version_id);

-- Force RLS on user-owned tables to avoid accidental owner bypass.
alter table public.experiences force row level security;
alter table public.experience_versions force row level security;
alter table public.generation_runs force row level security;
alter table public.chat_threads force row level security;
alter table public.chat_messages force row level security;
alter table public.assistant_runs force row level security;
alter table public.tool_invocations force row level security;
alter table public.sandbox_states force row level security;

-- Policy hardening: limit to authenticated role and use cached auth.uid() pattern.
alter policy experiences_owner_select on public.experiences
  to authenticated
  using (user_id = (select auth.uid()));

alter policy experiences_owner_insert on public.experiences
  to authenticated
  with check (user_id = (select auth.uid()));

alter policy experiences_owner_update on public.experiences
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy experiences_owner_delete on public.experiences
  to authenticated
  using (user_id = (select auth.uid()));

alter policy generation_runs_owner_select on public.generation_runs
  to authenticated
  using (user_id = (select auth.uid()));

alter policy generation_runs_owner_insert on public.generation_runs
  to authenticated
  with check (user_id = (select auth.uid()));

alter policy generation_runs_owner_update on public.generation_runs
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy generation_runs_owner_delete on public.generation_runs
  to authenticated
  using (user_id = (select auth.uid()));

alter policy chat_threads_owner_select on public.chat_threads
  to authenticated
  using (user_id = (select auth.uid()));

alter policy chat_threads_owner_insert on public.chat_threads
  to authenticated
  with check (user_id = (select auth.uid()));

alter policy chat_threads_owner_update on public.chat_threads
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy chat_threads_owner_delete on public.chat_threads
  to authenticated
  using (user_id = (select auth.uid()));

alter policy chat_messages_owner_select on public.chat_messages
  to authenticated
  using (user_id = (select auth.uid()));

alter policy chat_messages_owner_insert on public.chat_messages
  to authenticated
  with check (user_id = (select auth.uid()));

alter policy chat_messages_owner_update on public.chat_messages
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy chat_messages_owner_delete on public.chat_messages
  to authenticated
  using (user_id = (select auth.uid()));

alter policy experience_versions_owner_select on public.experience_versions
  to authenticated
  using (
    exists (
      select 1
      from public.experiences e
      where e.id = experience_versions.experience_id
        and e.user_id = (select auth.uid())
    )
  );

alter policy experience_versions_owner_insert on public.experience_versions
  to authenticated
  with check (
    exists (
      select 1
      from public.experiences e
      where e.id = experience_versions.experience_id
        and e.user_id = (select auth.uid())
    )
  );

alter policy experience_versions_owner_update on public.experience_versions
  to authenticated
  using (
    exists (
      select 1
      from public.experiences e
      where e.id = experience_versions.experience_id
        and e.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.experiences e
      where e.id = experience_versions.experience_id
        and e.user_id = (select auth.uid())
    )
  );

alter policy experience_versions_owner_delete on public.experience_versions
  to authenticated
  using (
    exists (
      select 1
      from public.experiences e
      where e.id = experience_versions.experience_id
        and e.user_id = (select auth.uid())
    )
  );

alter policy assistant_runs_owner_select on public.assistant_runs
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = assistant_runs.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy assistant_runs_owner_insert on public.assistant_runs
  to authenticated
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = assistant_runs.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy assistant_runs_owner_update on public.assistant_runs
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = assistant_runs.thread_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = assistant_runs.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy assistant_runs_owner_delete on public.assistant_runs
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = assistant_runs.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy tool_invocations_owner_select on public.tool_invocations
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = tool_invocations.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy tool_invocations_owner_insert on public.tool_invocations
  to authenticated
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = tool_invocations.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy tool_invocations_owner_update on public.tool_invocations
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = tool_invocations.thread_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = tool_invocations.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy tool_invocations_owner_delete on public.tool_invocations
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = tool_invocations.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy sandbox_states_owner_select on public.sandbox_states
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = sandbox_states.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy sandbox_states_owner_insert on public.sandbox_states
  to authenticated
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = sandbox_states.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy sandbox_states_owner_update on public.sandbox_states
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = sandbox_states.thread_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = sandbox_states.thread_id
        and t.user_id = (select auth.uid())
    )
  );

alter policy sandbox_states_owner_delete on public.sandbox_states
  to authenticated
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = sandbox_states.thread_id
        and t.user_id = (select auth.uid())
    )
  );
