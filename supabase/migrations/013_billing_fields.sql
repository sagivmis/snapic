-- Billing tracking fields

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'pending'
    CHECK (billing_status IS NULL OR billing_status IN ('pending', 'paid', 'included'));

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  stripe_event_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_cents INT,
  currency TEXT DEFAULT 'usd',
  plan TEXT,
  paid_by TEXT CHECK (paid_by IS NULL OR paid_by IN ('photographer', 'couple')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_events_org_idx ON public.billing_events(organization_id);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_events_select ON public.billing_events
  FOR SELECT USING (
    public.is_super_admin()
    OR (
      organization_id IS NOT NULL
      AND public.is_org_owner(organization_id)
    )
  );
