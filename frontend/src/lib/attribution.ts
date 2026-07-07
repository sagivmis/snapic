const STORAGE_KEY = "snapic_attribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AttributionData {
  ref?: string;
  promo?: string;
  plan?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  captured_at: number;
}

function readStored(): AttributionData | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AttributionData;
    if (Date.now() - parsed.captured_at > TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(data: AttributionData): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

/** Capture ?ref= and UTM params from the current URL (call on page load). */
export function captureAttributionFromUrl(search: string): void {
  const params = new URLSearchParams(search);
  const ref = params.get("ref")?.trim();
  const promo = params.get("promo")?.trim();
  const plan = params.get("plan")?.trim();
  const utm_source = params.get("utm_source")?.trim();
  const utm_medium = params.get("utm_medium")?.trim();
  const utm_campaign = params.get("utm_campaign")?.trim();

  if (!ref && !promo && !plan && !utm_source && !utm_medium && !utm_campaign) {
    return;
  }

  const existing = readStored();
  writeStored({
    ref: ref || existing?.ref,
    promo: promo || existing?.promo,
    plan: plan || existing?.plan,
    utm_source: utm_source || existing?.utm_source,
    utm_medium: utm_medium || existing?.utm_medium,
    utm_campaign: utm_campaign || existing?.utm_campaign,
    captured_at: Date.now(),
  });
}

export function getPromoCode(): string | null {
  return readStored()?.promo ?? null;
}

export function getPlanPreference(): string | null {
  return readStored()?.plan ?? null;
}

export function buildStudioSignupUrl(options: { promo?: string; plan?: string } = {}): string {
  const stored = readStored();
  const promo = options.promo ?? stored?.promo;
  const plan = options.plan ?? stored?.plan;
  const params = new URLSearchParams();
  if (promo) {
    params.set("promo", promo);
  }
  if (plan) {
    params.set("plan", plan);
  }
  const qs = params.toString();
  return qs ? `/studio/signup?${qs}` : "/studio/signup";
}

export function isMarketingTraffic(): boolean {
  const data = readStored();
  if (!data) {
    return false;
  }
  return Boolean(data.utm_source || data.utm_medium || data.utm_campaign);
}

export function getReferralCode(): string | null {
  return readStored()?.ref ?? null;
}

export function getAttribution(): AttributionData | null {
  return readStored();
}
