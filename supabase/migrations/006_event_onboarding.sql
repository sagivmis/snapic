-- Track when a couple finishes the first-run setup wizard
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
