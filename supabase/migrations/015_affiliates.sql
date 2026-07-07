-- Affiliate referral program + signup attribution

CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX affiliates_status_idx ON public.affiliates(status);

ALTER TABLE public.signup_requests
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS signup_requests_referral_code_idx
  ON public.signup_requests(referral_code);

CREATE TABLE public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  signup_request_id UUID NOT NULL UNIQUE REFERENCES public.signup_requests(id) ON DELETE CASCADE,
  amount_nis INT NOT NULL CHECK (amount_nis > 0),
  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'paid', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX affiliate_payouts_affiliate_idx ON public.affiliate_payouts(affiliate_id);
CREATE INDEX affiliate_payouts_status_idx ON public.affiliate_payouts(status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Service role only (no public policies)
