-- Snapic multi-tenant schema + RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  global_role TEXT NOT NULL DEFAULT 'guest'
    CHECK (global_role IN ('super_admin', 'event_admin', 'guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  wedding_date DATE,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  default_threshold REAL NOT NULL DEFAULT 0.4,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX events_slug_idx ON public.events(slug);
CREATE INDEX events_status_idx ON public.events(status);

CREATE TABLE public.event_members (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'co_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE public.signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  couple_names TEXT NOT NULL,
  wedding_date DATE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX signup_requests_status_idx ON public.signup_requests(status);

CREATE TABLE public.gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX gallery_photos_event_idx ON public.gallery_photos(event_id);

CREATE TABLE public.match_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_session_id TEXT,
  couple_mode BOOLEAN NOT NULL DEFAULT FALSE,
  threshold REAL NOT NULL,
  total_gallery INT NOT NULL DEFAULT 0,
  matched_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX match_runs_event_idx ON public.match_runs(event_id);
CREATE INDEX match_runs_user_idx ON public.match_runs(user_id);
CREATE INDEX match_runs_anon_idx ON public.match_runs(anonymous_session_id);

CREATE TABLE public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_run_id UUID NOT NULL REFERENCES public.match_runs(id) ON DELETE CASCADE,
  gallery_photo_id UUID REFERENCES public.gallery_photos(id) ON DELETE SET NULL,
  score REAL NOT NULL,
  matched_person TEXT,
  person_1_score REAL,
  person_2_score REAL,
  preview_path TEXT,
  filename TEXT,
  sort_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX match_results_run_idx ON public.match_results(match_run_id);

CREATE TABLE public.share_tokens (
  token TEXT PRIMARY KEY,
  match_run_id UUID NOT NULL REFERENCES public.match_runs(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX share_tokens_run_idx ON public.share_tokens(match_run_id);

CREATE TABLE public.skipped_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_run_id UUID NOT NULL REFERENCES public.match_runs(id) ON DELETE CASCADE,
  gallery_photo_id UUID REFERENCES public.gallery_photos(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  filename TEXT,
  sort_index INT NOT NULL DEFAULT 0
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
BEGIN
  meta_role := COALESCE(NEW.raw_app_meta_data->>'role', 'guest');
  IF meta_role NOT IN ('super_admin', 'event_admin', 'guest') THEN
    meta_role := 'guest';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    meta_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helpers
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skipped_photos ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_super_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_super_admin());

-- Events: public read active/draft for members; anon read active only via slug
CREATE POLICY events_select_active ON public.events
  FOR SELECT USING (
    status = 'active'
    OR public.is_super_admin()
    OR public.is_event_member(id)
  );

CREATE POLICY events_insert_super ON public.events
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY events_update ON public.events
  FOR UPDATE USING (public.is_super_admin() OR public.is_event_admin(id));

CREATE POLICY events_delete_super ON public.events
  FOR DELETE USING (public.is_super_admin());

-- Event members
CREATE POLICY event_members_select ON public.event_members
  FOR SELECT USING (public.is_super_admin() OR public.is_event_member(event_id) OR user_id = auth.uid());

CREATE POLICY event_members_insert ON public.event_members
  FOR INSERT WITH CHECK (public.is_super_admin() OR public.is_event_admin(event_id));

CREATE POLICY event_members_delete ON public.event_members
  FOR DELETE USING (public.is_super_admin() OR public.is_event_admin(event_id));

-- Signup requests: anyone can insert; super admin manages
CREATE POLICY signup_requests_insert_public ON public.signup_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY signup_requests_select ON public.signup_requests
  FOR SELECT USING (public.is_super_admin() OR email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY signup_requests_update_super ON public.signup_requests
  FOR UPDATE USING (public.is_super_admin());

-- Gallery photos
CREATE POLICY gallery_photos_select ON public.gallery_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'active')
    OR public.is_event_admin(event_id)
  );

CREATE POLICY gallery_photos_insert ON public.gallery_photos
  FOR INSERT WITH CHECK (public.is_event_admin(event_id));

CREATE POLICY gallery_photos_delete ON public.gallery_photos
  FOR DELETE USING (public.is_event_admin(event_id));

-- Match runs: users see own; event admins see all for their event
CREATE POLICY match_runs_select ON public.match_runs
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_event_admin(event_id)
    OR public.is_super_admin()
  );

CREATE POLICY match_runs_insert_service ON public.match_runs
  FOR INSERT WITH CHECK (true);

-- Match results via run ownership
CREATE POLICY match_results_select ON public.match_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.match_runs r
      WHERE r.id = match_run_id
        AND (r.user_id = auth.uid() OR public.is_event_admin(r.event_id) OR public.is_super_admin())
    )
  );

-- Share tokens: read by token (handled via RPC); admins read all for event
CREATE POLICY share_tokens_select ON public.share_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.match_runs r
      WHERE r.id = match_run_id
        AND (r.user_id = auth.uid() OR public.is_event_admin(r.event_id) OR public.is_super_admin())
    )
  );

-- Skipped photos
CREATE POLICY skipped_photos_select ON public.skipped_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.match_runs r
      WHERE r.id = match_run_id
        AND (r.user_id = auth.uid() OR public.is_event_admin(r.event_id) OR public.is_super_admin())
    )
  );

-- Public RPC: get event by slug (active only for anon)
CREATE OR REPLACE FUNCTION public.get_event_by_slug(p_slug TEXT)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.events
  WHERE slug = p_slug
    AND (status = 'active' OR public.is_super_admin() OR public.is_event_member(id));
$$;

GRANT EXECUTE ON FUNCTION public.get_event_by_slug(TEXT) TO anon, authenticated;

-- Link anonymous sessions to user after sign-in
CREATE OR REPLACE FUNCTION public.claim_anonymous_match_runs(p_session_id TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.match_runs
  SET user_id = auth.uid()
  WHERE anonymous_session_id = p_session_id
    AND user_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_anonymous_match_runs(TEXT) TO authenticated;
