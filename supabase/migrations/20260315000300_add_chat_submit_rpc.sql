-- Atomic chat message submission and run creation with idempotency + concurrency guard.

create unique index if not exists idx_assistant_runs_single_active_per_thread
  on public.assistant_runs (thread_id)
  where status in ('queued', 'running');

create or replace function public.chat_submit_user_message(
  p_thread_id uuid,
  p_client_id text,
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
  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'Message content must be non-empty.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.chat_threads
    where id = p_thread_id
      and client_id = p_client_id
  ) then
    raise exception 'Thread not found for client scope.' using errcode = 'P0001';
  end if;

  v_idempotency_key := nullif(trim(coalesce(p_idempotency_key, '')), '');

  if v_idempotency_key is not null then
    select m.id, m.created_at
    into v_existing_message_id, v_existing_message_created_at
    from public.chat_messages m
    where m.thread_id = p_thread_id
      and m.client_id = p_client_id
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
    client_id,
    role,
    content,
    content_json,
    idempotency_key
  )
  values (
    p_thread_id,
    p_client_id,
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
