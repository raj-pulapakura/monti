-- Per-user onboarding profile (role, context) for personalization and settings.

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null
    check (
      role in (
        'educator',
        'tutor',
        'student',
        'parent',
        'learning_on_my_own',
        'other'
      )
    ),
  context text not null
    check (
      context in (
        'k12',
        'higher_ed',
        'corporate',
        'personal'
      )
    ),
  role_other_text text null,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_profiles_onboarding_completed_at
  on public.user_profiles (onboarding_completed_at);

alter table public.user_profiles enable row level security;

create policy user_profiles_owner_select on public.user_profiles
  for select
  using (user_id = auth.uid());

create policy user_profiles_owner_insert on public.user_profiles
  for insert
  with check (user_id = auth.uid());

create policy user_profiles_owner_update on public.user_profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
