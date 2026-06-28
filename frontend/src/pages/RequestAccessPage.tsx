import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { submitSignupRequest } from "../api/client";
import { useTranslation } from "../i18n";
import { track } from "../lib/analytics";
import "../styles/RequestAccess.scss";

const BENEFIT_KEYS = ["private", "instant", "setup"] as const;
const NEXT_STEP_KEYS = ["review", "email", "share"] as const;

export function RequestAccessPage() {
  const { t, tPath } = useTranslation("requestAccess");
  const [email, setEmail] = useState("");
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitSignupRequest({
        email: email.trim(),
        couple_names: coupleNames.trim(),
        wedding_date: weddingDate || null,
        message: message.trim() || null,
      });
      setSubmitted(true);
      track("request_access_submitted", { hasDate: Boolean(weddingDate) });
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("submitFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    const trimmedNames = coupleNames.trim();
    const namePart = trimmedNames
      ? tPath("successLeadNamePart", { name: trimmedNames })
      : "";
    const submittedEmail = email.trim();
    const emailDomain = submittedEmail.split("@")[1] ?? "";
    const webmailHref = emailDomain
      ? `https://${emailDomain}`
      : "mailto:";

    return (
      <div className="request-page">
        <div className="request-page__success card-wedding">
          <div className="request-page__success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="request-page__eyebrow">{tPath("successEyebrow")}</p>
          <h1>{tPath("successTitle")}</h1>
          <p className="request-page__success-lead">
            {tPath("successLead", { namePart, email: submittedEmail })}
          </p>
          <p className="request-page__success-promise">{tPath("successFastPromise")}</p>
          <ul className="request-page__next-steps">
            {NEXT_STEP_KEYS.map((key) => (
              <li key={key}>{tPath(`nextSteps.${key}`)}</li>
            ))}
          </ul>
          <div className="request-page__success-actions">
            <a href={webmailHref} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {tPath("openMail")}
            </a>
            <Link to={`/login?next=/`} className="btn btn-secondary">
              {tPath("alreadyApproved")}
            </Link>
          </div>
          <button
            type="button"
            className="request-page__resubmit"
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
          >
            {tPath("wrongEmail")}
          </button>
          <Link to="/" className="request-page__success-back">
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="request-page">
      <div className="request-page__layout">
        <section className="request-page__intro">
          <p className="request-page__eyebrow">{tPath("eyebrow")}</p>
          <h1>{tPath("title")}</h1>
          <p className="request-page__lead">{tPath("lead")}</p>

          <ul className="request-page__benefits">
            {BENEFIT_KEYS.map((key) => (
              <li key={key} className="request-page__benefit">
                <span className="request-page__benefit-marker" aria-hidden="true" />
                <div>
                  <strong>{tPath(`benefits.${key}.title`)}</strong>
                  <p>{tPath(`benefits.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="request-page__visual" aria-hidden="true">
            <div className="request-page__mock">
              <div className="request-page__mock-header">
                <span className="request-page__mock-avatar" />
                <div>
                  <strong>{tPath("mockTitle")}</strong>
                  <span>{tPath("mockProgress")}</span>
                </div>
              </div>
              <div className="request-page__mock-grid">
                <span className="request-page__mock-photo request-page__mock-photo--match" />
                <span className="request-page__mock-photo" />
                <span className="request-page__mock-photo request-page__mock-photo--match" />
                <span className="request-page__mock-photo request-page__mock-photo--match" />
              </div>
            </div>
          </div>
        </section>

        <section className="request-page__panel card-wedding">
          <div className="request-page__panel-head">
            <h2>{tPath("panelTitle")}</h2>
            <p>{tPath("panelLead")}</p>
          </div>

          <form className="request-page__form" onSubmit={handleSubmit}>
            <div className="request-page__field">
              <label htmlFor="email">{tPath("emailLabel")}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tPath("emailPlaceholder")}
              />
            </div>

            <div className="request-page__field">
              <label htmlFor="couple">{tPath("coupleLabel")}</label>
              <input
                id="couple"
                required
                value={coupleNames}
                onChange={(e) => setCoupleNames(e.target.value)}
                placeholder={tPath("couplePlaceholder")}
              />
            </div>

            <div className="request-page__field">
              <label htmlFor="date">
                {tPath("dateLabel")} <span className="request-page__optional">{t("optional")}</span>
              </label>
              <input
                id="date"
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
              />
            </div>

            <div className="request-page__field">
              <label htmlFor="message">
                {tPath("messageLabel")}{" "}
                <span className="request-page__optional">{t("optional")}</span>
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={tPath("messagePlaceholder")}
              />
            </div>

            <button type="submit" className="btn btn-primary request-page__submit" disabled={busy}>
              {busy ? t("submitting") : tPath("submitBtn")}
            </button>
          </form>

          {error && <p className="error-banner">{error}</p>}

          <p className="request-page__footnote">
            {tPath("footnote")}{" "}
            <Link to="/demo">{tPath("tryDemo")}</Link> or{" "}
            <Link to="/">{tPath("returnHome")}</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
