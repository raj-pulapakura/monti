alter table public.experience_versions
  drop column if exists format,
  drop column if exists audience;
