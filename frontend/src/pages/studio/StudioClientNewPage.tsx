import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudioClient } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "../../i18n";
import { clearStudioDashboardCache } from "../../lib/studioCache";
import "../../styles/StudioLayout.scss";

const NEXT_STEP_KEYS = ["steps.upload", "steps.index", "steps.handoff"] as const;

export function StudioClientNewPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { t, tPath } = useTranslation("studio.clientNew");
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const client = await createStudioClient(
        {
          couple_names: coupleNames.trim(),
          wedding_date: weddingDate || null,
          client_email: clientEmail.trim() || null,
          photographer_notes: notes.trim() || null,
        },
        token,
      );
      clearStudioDashboardCache();
      navigate(`/studio/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page studio-client-new">
      <header className="studio-client-new__header">
        <div className="studio-client-new__header-row">
          <Link to="/studio/clients" className="studio-client-new__back">
            {tPath("backClients")}
          </Link>
          <p className="studio-client-new__eyebrow">{tPath("eyebrow")}</p>
        </div>
        <h1>{tPath("title")}</h1>
      </header>

      <ol className="studio-client-new__steps" aria-label={t("clientNewSteps")}>
        {NEXT_STEP_KEYS.map((stepKey, index) => (
          <li key={stepKey} className="studio-client-new__step">
            <span className="studio-client-new__step-num" aria-hidden="true">
              {index + 1}
            </span>
            <span className="studio-client-new__step-copy">
              <strong>{tPath(`${stepKey}.title`)}</strong>
              <span>{tPath(`${stepKey}.detail`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="studio-client-new__form-card">
        <form className="studio-form studio-client-new__form" onSubmit={handleSubmit}>
          <div className="studio-client-new__form-body">
            <div className="studio-client-new__fields">
              <div className="studio-client-new__section">
                <h2>{tPath("aboutCouple")}</h2>

                <label htmlFor="names">{tPath("coupleNamesLabel")}</label>
                <input
                  id="names"
                  required
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  placeholder={tPath("coupleNamesPlaceholder")}
                  autoComplete="off"
                />

                <label htmlFor="date">{tPath("weddingDateLabel")}</label>
                <input
                  id="date"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>

              <div className="studio-client-new__section">
                <h2>{tPath("optionalSection")}</h2>

                <label htmlFor="email">{tPath("coupleEmailLabel")}</label>
                <input
                  id="email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder={tPath("coupleEmailPlaceholder")}
                  autoComplete="email"
                />

                <label htmlFor="notes">{tPath("notesLabel")}</label>
                <textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tPath("notesPlaceholder")}
                />
              </div>
            </div>
          </div>

          <div className="studio-client-new__actions">
            <Link to="/studio/clients" className="btn btn-ghost">
              {t("cancel")}
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? tPath("creating") : tPath("createBtn")}
            </button>
          </div>
        </form>
        {error && <p className="error-banner">{error}</p>}
      </section>
    </div>
  );
}
