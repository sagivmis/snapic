import { useCallback, useEffect, useState } from "react";
import { createStripeCheckout, fetchStudioBilling } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { StudioBilling } from "../../types";
import "../../styles/StudioLayout.scss";

const PLANS = [
  { id: "pay_per_event", label: "Pay per event", price: "$99" },
  { id: "bundle_10", label: "10 events / year", price: "$649" },
  { id: "bundle_25", label: "25 events / year", price: "$1,299" },
  { id: "unlimited", label: "Unlimited (fair use)", price: "$799/mo" },
] as const;

export function StudioBillingPage() {
  const { getAccessToken } = useAuth();
  const [billing, setBilling] = useState<StudioBilling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    setBilling(await fetchStudioBilling(token));
  }, [getAccessToken]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  async function startCheckout(plan: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const origin = window.location.origin;
      const session = await createStripeCheckout(
        {
          plan,
          paid_by: "photographer",
          success_url: `${origin}/studio/billing?success=1`,
          cancel_url: `${origin}/studio/billing`,
        },
        token,
      );
      window.location.href = session.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page">
      <h1>Billing</h1>
      {billing && (
        <p>
          Plan: <strong>{billing.plan}</strong> · Used {billing.events_used_this_period} /{" "}
          {billing.events_included_per_period || "∞"} events
        </p>
      )}
      <div className="studio-page__stats">
        {PLANS.map((plan) => (
          <div key={plan.id} className="studio-page__stat">
            <span className="studio-page__stat-value">{plan.price}</span>
            <span className="studio-page__stat-label">{plan.label}</span>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startCheckout(plan.id)}>
              Choose
            </button>
          </div>
        ))}
      </div>
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
