-- Favourite flag per experience (user-owned; single column, no join table).
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS is_favourite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.experiences.is_favourite IS 'User-curated bookmark for the library; scoped to owning user.';
