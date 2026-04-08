-- Drop version-scoped title; title lives only on experiences.
alter table public.experience_versions
  drop column if exists title;

