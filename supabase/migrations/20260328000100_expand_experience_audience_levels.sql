-- Expand supported learner audience levels beyond early education.

alter table public.experience_versions
  drop constraint if exists experience_versions_audience_check;

alter table public.experience_versions
  add constraint experience_versions_audience_check
  check (
    audience in (
      'young-kids',
      'elementary',
      'middle-school',
      'high-school',
      'university',
      'adult'
    )
    or audience is null
  );
