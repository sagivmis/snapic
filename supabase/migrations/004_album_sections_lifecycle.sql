-- Album sections + event auto-archive setting
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS gallery_photos_event_section_idx
  ON public.gallery_photos(event_id, section);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_archive_days INT NOT NULL DEFAULT 90;

-- Auto-add event membership when invited via admin invite metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  pending_event UUID;
  pending_role TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_app_meta_data->>'role', 'guest');
  IF meta_role NOT IN ('super_admin', 'event_admin', 'guest') THEN
    meta_role := 'guest';
  END IF;

  pending_event := NULLIF(NEW.raw_user_meta_data->>'pending_event_id', '')::UUID;
  pending_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'pending_event_role', ''), 'admin');
  IF pending_event IS NOT NULL THEN
    meta_role := 'event_admin';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    meta_role
  );

  IF pending_event IS NOT NULL THEN
    INSERT INTO public.event_members (event_id, user_id, role)
    VALUES (pending_event, NEW.id, pending_role)
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
