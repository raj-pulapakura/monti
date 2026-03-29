-- Harden internal trigger helpers used by the persistence and chat runtime schema.

create index if not exists idx_tool_invocations_experience_id
  on public.tool_invocations (experience_id);

create or replace function public._set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public._set_updated_at() from public;

create or replace function public._experiences_set_latest_version()
returns trigger
language plpgsql
security definer
set search_path = ''
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

revoke all on function public._experiences_set_latest_version() from public;
