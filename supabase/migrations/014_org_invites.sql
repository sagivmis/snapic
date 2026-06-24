-- Pending studio membership invites (accept/decline before joining org_members)

CREATE TABLE public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'associate' CHECK (role IN ('owner', 'associate')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX org_invites_pending_org_email_idx
  ON public.org_invites(org_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX org_invites_user_pending_idx
  ON public.org_invites(user_id)
  WHERE status = 'pending';

CREATE INDEX org_invites_email_pending_idx
  ON public.org_invites(lower(email))
  WHERE status = 'pending';

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_select ON public.org_invites
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR lower(email) = lower(COALESCE((SELECT email FROM public.profiles WHERE id = auth.uid()), ''))
    OR public.is_org_owner(org_id)
  );

-- Stop auto-adding org members from Supabase invite metadata; link pending invites instead.
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

  UPDATE public.org_invites
  SET user_id = NEW.id
  WHERE status = 'pending'
    AND lower(email) = lower(NEW.email)
    AND (pending_org IS NULL OR org_id = pending_org);

  RETURN NEW;
END;
$$;
