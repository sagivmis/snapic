-- Realtime admin dashboard: subscribe to notable table changes as super admin.

-- Super admins should be able to read gallery rows (used by RLS on realtime payloads).
DROP POLICY IF EXISTS gallery_photos_select ON public.gallery_photos;
CREATE POLICY gallery_photos_select ON public.gallery_photos
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.status = 'active'
    )
    OR public.is_event_admin(event_id)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'signup_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.signup_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_runs;
  END IF;
END $$;
