-- Organizations (photographer studios) and org membership

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_storage_path TEXT,
  website_url TEXT,
  accent_color TEXT,
  plan TEXT NOT NULL DEFAULT 'pay_per_event'
    CHECK (plan IN ('pay_per_event', 'bundle_10', 'bundle_25', 'unlimited')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  events_included_per_period INT NOT NULL DEFAULT 0,
  events_used_this_period INT NOT NULL DEFAULT 0,
  photos_cap_per_event INT,
  branding_tier TEXT NOT NULL DEFAULT 'standard'
    CHECK (branding_tier IN ('standard', 'pro', 'white_label')),
  settings JSONB NOT NULL DEFAULT '{
    "require_couple_go_live": false,
    "associate_scope": "org"
  }'::jsonb,
  billing_period_start DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX organizations_slug_idx ON public.organizations(slug);

CREATE TABLE public.org_members (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'associate' CHECK (role IN ('owner', 'associate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX org_members_user_idx ON public.org_members(user_id);

-- Optional per-event associate assignment when associate_scope = 'event'
CREATE TABLE public.org_event_assignments (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, event_id, user_id)
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (handoff_status IN ('draft', 'uploaded', 'invited', 'live', 'closed')),
  ADD COLUMN IF NOT EXISTS photographer_notes TEXT,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT,
  ADD COLUMN IF NOT EXISTS photo_limit INT,
  ADD COLUMN IF NOT EXISTS paid_by TEXT CHECK (paid_by IS NULL OR paid_by IN ('photographer', 'couple'));

CREATE INDEX events_organization_idx ON public.events(organization_id);

-- RLS helpers
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_event_access(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.org_members om ON om.org_id = e.organization_id
    JOIN public.organizations o ON o.id = e.organization_id
    WHERE e.id = p_event_id
      AND om.user_id = auth.uid()
      AND (
        om.role = 'owner'
        OR COALESCE(o.settings->>'associate_scope', 'org') = 'org'
        OR EXISTS (
          SELECT 1 FROM public.org_event_assignments a
          WHERE a.event_id = p_event_id AND a.user_id = auth.uid()
        )
      )
  );
$$;

-- Extend is_event_admin for org members (gallery upload access)
CREATE OR REPLACE FUNCTION public.is_event_admin(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members
      WHERE event_id = p_event_id AND user_id = auth.uid()
    )
    OR public.is_org_event_access(p_event_id);
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_event_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON public.organizations
  FOR SELECT USING (public.is_org_member(id) OR public.is_super_admin());

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE USING (public.is_org_owner(id) OR public.is_super_admin());

CREATE POLICY organizations_insert ON public.organizations
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY org_members_select ON public.org_members
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_super_admin());

CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT WITH CHECK (public.is_org_owner(org_id) OR public.is_super_admin());

CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE USING (public.is_org_owner(org_id) OR public.is_super_admin());

CREATE POLICY org_event_assignments_select ON public.org_event_assignments
  FOR SELECT USING (public.is_org_member(org_id) OR public.is_super_admin());

CREATE POLICY org_event_assignments_insert ON public.org_event_assignments
  FOR INSERT WITH CHECK (public.is_org_owner(org_id) OR public.is_super_admin());

CREATE POLICY org_event_assignments_delete ON public.org_event_assignments
  FOR DELETE USING (public.is_org_owner(org_id) OR public.is_super_admin());

-- Allow org members to insert events for their org
CREATE POLICY events_insert_org ON public.events
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND public.is_org_member(organization_id)
    )
  );
