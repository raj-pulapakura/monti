-- Replace generic k12 with granular K-12 segments for clearer product segmentation.

alter table public.user_profiles drop constraint if exists user_profiles_context_check;

update public.user_profiles
set context = 'k12_mixed'
where context = 'k12';

alter table public.user_profiles
  add constraint user_profiles_context_check check (
    context in (
      'k12_elementary',
      'k12_middle',
      'k12_high',
      'k12_mixed',
      'higher_ed',
      'corporate',
      'personal'
    )
  );
