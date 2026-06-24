-- Rename event status archived -> closed; auto_archive_days -> auto_close_days

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;

UPDATE public.events SET status = 'closed' WHERE status = 'archived';

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'active', 'closed'));

ALTER TABLE public.events
  RENAME COLUMN auto_archive_days TO auto_close_days;

-- Update get_event_by_slug: active events only for anon (closed excluded like archived was)
CREATE OR REPLACE FUNCTION public.get_event_by_slug(p_slug TEXT)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.events
  WHERE slug = p_slug
    AND (
      status = 'active'
      OR public.is_super_admin()
      OR public.is_event_member(id)
    );
$$;
