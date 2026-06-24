import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { submitSignupRequest } from "../api/client";
import "../styles/RequestAccess.scss";

const BENEFITS = [
  {
    title: "Private gallery for your wedding",
    description: "A dedicated space where you and your guests can find every photo from your day.",
  },
  {
    title: "Guests find themselves instantly",
    description: "Upload a selfie once — Snapic matches you across the full album in seconds.",
  },
  {
    title: "We handle the setup",
    description: "Tell us a few details and we’ll reach out when your gallery is ready to go live.",
  },
] as const;

const NEXT_STEPS = [
  "We review your request within a couple of business days.",
  "You’ll get an email when your private gallery is ready.",
  "Share the guest link so friends and family can find their photos.",
] as const;

export function RequestAccessPage() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="request-page">
        <div className="request-page__success card-wedding">
          <div className="request-page__success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="request-page__eyebrow">Request received</p>
          <h1>We&apos;re on it</h1>
          <p className="request-page__success-lead">
            Thanks{coupleNames.trim() ? `, ${coupleNames.trim()}` : ""}! We&apos;ll review your
            request and email <strong>{email.trim()}</strong> when your wedding gallery is ready.
          </p>
          <ul className="request-page__next-steps">
            {NEXT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <Link to="/" className="btn btn-secondary">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="request-page">
      <div className="request-page__layout">
        <section className="request-page__intro">
          <p className="request-page__eyebrow">For couples</p>
          <h1>Request your wedding gallery</h1>
          <p className="request-page__lead">
            Ask for a private Snapic gallery for your wedding. We&apos;ll review your details and
            email you when your event is ready for guests.
          </p>

          <ul className="request-page__benefits">
            {BENEFITS.map((item) => (
              <li key={item.title} className="request-page__benefit">
                <span className="request-page__benefit-marker" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="request-page__visual" aria-hidden="true">
            <div className="request-page__mock">
              <div className="request-page__mock-header">
                <span className="request-page__mock-avatar" />
                <div>
                  <strong>Your wedding gallery</strong>
                  <span>12 photos found so far</span>
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
            <h2>Tell us about your wedding</h2>
            <p>All fields marked required help us set up your gallery faster.</p>
          </div>

          <form className="request-page__form" onSubmit={handleSubmit}>
            <div className="request-page__field">
              <label htmlFor="email">Your email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="request-page__field">
              <label htmlFor="couple">Couple names</label>
              <input
                id="couple"
                required
                value={coupleNames}
                onChange={(e) => setCoupleNames(e.target.value)}
                placeholder="Alex & Jordan"
              />
            </div>

            <div className="request-page__field">
              <label htmlFor="date">
                Wedding date <span className="request-page__optional">(optional)</span>
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
                Message <span className="request-page__optional">(optional)</span>
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Photographer name, venue, or anything else we should know…"
              />
            </div>

            <button type="submit" className="btn btn-primary request-page__submit" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </form>

          {error && <p className="error-banner">{error}</p>}

          <p className="request-page__footnote">
            Prefer to explore first?{" "}
            <Link to="/demo">Try the guest demo</Link> or{" "}
            <Link to="/">return home</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
