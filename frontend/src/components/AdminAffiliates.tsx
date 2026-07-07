import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  createAdminAffiliate,
  fetchAdminAffiliatePayouts,
  fetchAdminAffiliates,
  markAdminAffiliatePayoutsPaid,
  type AffiliatePayout,
  type AffiliateSummary,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import { SITE_ORIGIN } from "../lib/site";
import "../styles/AdminAffiliates.scss";

export function AdminAffiliates() {
  const { getAccessToken } = useAuth();
  const { tPath } = useTranslation("admin.affiliates");
  const [affiliates, setAffiliates] = useState<AffiliateSummary[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    const [aff, pay] = await Promise.all([
      fetchAdminAffiliates(token),
      fetchAdminAffiliatePayouts(token, "accrued"),
    ]);
    setAffiliates(aff);
    setPayouts(pay);
  }, [getAccessToken]);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    });
  }, [refresh, tPath]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(tPath("notSignedIn"));
      }
      await createAdminAffiliate(
        { code: code.trim(), display_name: displayName.trim(), email: email.trim() },
        token,
      );
      setCode("");
      setDisplayName("");
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    const ids = payouts.map((p) => p.id);
    if (ids.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(tPath("notSignedIn"));
      }
      await markAdminAffiliatePayoutsPaid(ids, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("markPaidFailed"));
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : SITE_ORIGIN;

  return (
    <section className="admin-affiliates card-wedding" id="admin-affiliates">
      <header className="admin-affiliates__head">
        <h2>{tPath("title")}</h2>
        <p>{tPath("lead")}</p>
      </header>

      <form className="admin-affiliates__form" onSubmit={handleCreate}>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={tPath("codePlaceholder")}
          pattern="[a-z0-9][a-z0-9-]{0,48}[a-z0-9]"
        />
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={tPath("namePlaceholder")}
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tPath("emailPlaceholder")}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {tPath("createBtn")}
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}

      <div className="admin-affiliates__table-wrap">
        <table className="admin-affiliates__table">
          <thead>
            <tr>
              <th>{tPath("colPartner")}</th>
              <th>{tPath("colLink")}</th>
              <th>{tPath("colSubmissions")}</th>
              <th>{tPath("colApproved")}</th>
              <th>{tPath("colAccrued")}</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.display_name}</strong>
                  <span className="admin-affiliates__muted">{row.email}</span>
                </td>
                <td>
                  <code>{origin}/r/{row.code}</code>
                </td>
                <td>{row.submissions}</td>
                <td>{row.approved}</td>
                <td>₪{row.accrued_nis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payouts.length > 0 && (
        <div className="admin-affiliates__payouts">
          <h3>{tPath("payoutsTitle", { count: payouts.length })}</h3>
          <ul>
            {payouts.map((p) => (
              <li key={p.id}>
                {p.affiliate_name} — {p.couple_names} — ₪{p.amount_nis}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void handleMarkPaid()}>
            {tPath("markAllPaid")}
          </button>
        </div>
      )}
    </section>
  );
}
