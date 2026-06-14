-- Storage bucket for event gallery and match previews

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'events',
  'events',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Event admins upload to events/{event_id}/gallery/*
CREATE POLICY events_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'events'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.status = 'active'
          AND (storage.foldername(name))[1] = e.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.event_members em ON em.event_id = e.id
        WHERE em.user_id = auth.uid()
          AND (storage.foldername(name))[1] = e.id::text
      )
    )
  );

CREATE POLICY events_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'events'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.user_id = auth.uid()
          AND (storage.foldername(name))[1] = em.event_id::text
      )
    )
  );

CREATE POLICY events_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'events'
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.user_id = auth.uid()
          AND (storage.foldername(name))[1] = em.event_id::text
      )
    )
  );
