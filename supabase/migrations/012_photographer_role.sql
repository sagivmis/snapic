-- Add photographer global role

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_global_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_global_role_check
  CHECK (global_role IN ('super_admin', 'photographer', 'event_admin', 'guest'));

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
  pending_org UUID;
BEGIN
  meta_role := COALESCE(NEW.raw_app_meta_data->>'role', 'guest');
  IF meta_role NOT IN ('super_admin', 'photographer', 'event_admin', 'guest') THEN
    meta_role := 'guest';
  END IF;

  pending_event := NULLIF(NEW.raw_user_meta_data->>'pending_event_id', '')::UUID;
  pending_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'pending_event_role', ''), 'admin');
  pending_org := NULLIF(NEW.raw_user_meta_data->>'pending_org_id', '')::UUID;

  IF pending_event IS NOT NULL AND meta_role NOT IN ('super_admin', 'photographer') THEN
    meta_role := 'event_admin';
  END IF;

  IF pending_org IS NOT NULL AND meta_role = 'guest' THEN
    meta_role := 'photographer';
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

  IF pending_org IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (
      pending_org,
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'pending_org_role', ''), 'associate')
    )
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Signup requests: photographer path
ALTER TABLE public.signup_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'couple'
    CHECK (request_type IN ('couple', 'photographer')),
  ADD COLUMN IF NOT EXISTS organization_name TEXT;
