-- User-submitted feedback (general app feedback and per-message thumbs).

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('general', 'thumbs_up', 'thumbs_down')),
  message text null,
  thread_id uuid null references public.chat_threads (id) on delete set null,
  message_id uuid null references public.chat_messages (id) on delete set null,
  experience_id uuid null references public.experiences (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_feedback_user_id_created_at on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

create policy feedback_owner_insert on public.feedback
  for insert
  with check (user_id = auth.uid());
