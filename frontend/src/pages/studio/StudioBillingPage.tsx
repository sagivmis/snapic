import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createStripeCheckout } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { useTranslation } from "../../i18n";
import "../../styles/StudioLayout.scss";

const PLAN_IDS = ["pay_per_event", "bundle_10", "bundle_25", "unlimited"] as const;

const PLAN_KEY_MAP: Record<(typeof PLAN_IDS)[number], string> = {
  pay_per_event: "payPerEvent",
  bundle_10: "bundle10",
  bundle_25: "bundle25",
  unlimited: "unlimited",
};

export function StudioBillingPage() {
  const { getAccessToken } = useAuth();
  const { organization, refreshOrganization } = useStudioOrg();
  const { t, tPath } = useTranslation("studio.billing");
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plans = useMemo(
    () =>
      PLAN_IDS.map((id) => ({
        id,
        label: tPath(`plans.${PLAN_KEY_MAP[id]}.label`),
        price: tPath(`plans.${PLAN_KEY_MAP[id]}.price`),
      })),
    [tPath],
  );

  useEffect(() => {
    if (searchParams.get("success") !== "1") {
      return;
    }
    void refreshOrganization().finally(() => {
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, refreshOrganization, setSearchParams]);

  async function startCheckout(plan: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
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
      setError(err instanceof Error ? err.message : tPath("checkoutFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page">
      <h1>{tPath("title")}</h1>
      {organization && (
        <p>
          {organization.events_included_per_period
            ? tPath("planUsage", {
                plan: organization.plan,
                used: organization.events_used_this_period,
                included: organization.events_included_per_period,
              })
            : tPath("planUsageUnlimited", {
                plan: organization.plan,
                used: organization.events_used_this_period,
              })}
        </p>
      )}
      <div className="studio-page__stats">
        {plans.map((plan) => (
          <div key={plan.id} className="studio-page__stat">
            <span className="studio-page__stat-value">{plan.price}</span>
            <span className="studio-page__stat-label">{plan.label}</span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void startCheckout(plan.id)}
            >
              {busy ? t("redirecting") : t("choose")}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
