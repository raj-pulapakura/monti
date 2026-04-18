-- Pause assistant runs for tool confirmation: new status, columns, and active-run index.

drop index if exists public.idx_assistant_runs_single_active_per_thread;

alter table public.assistant_runs drop constraint if exists assistant_runs_status_check;

alter table public.assistant_runs
  add constraint assistant_runs_status_check check (
    status in (
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'awaiting_confirmation'
    )
  );

alter table public.assistant_runs
  add column if not exists confirmation_tool_call_id text null;

alter table public.assistant_runs
  add column if not exists confirmation_metadata jsonb null;

create unique index idx_assistant_runs_single_active_per_thread
  on public.assistant_runs (thread_id)
  where status in ('queued', 'running', 'awaiting_confirmation');
