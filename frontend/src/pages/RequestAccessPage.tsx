import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { submitSignupRequest } from "../api/client";
import "../styles/AuthPages.scss";

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
      <div className="auth-page">
        <h1>Request received</h1>
        <p>We will review your request and email you when your event is ready.</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Request your wedding gallery</h1>
      <p className="auth-page__lead">
        Couples can request a private Snapic gallery for their wedding. We&apos;ll review your
        request and email you when your event is ready.
      </p>

      <form className="auth-page__form auth-page__form--wide" onSubmit={handleSubmit}>
        <label htmlFor="email">Your email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="couple">Couple names</label>
        <input
          id="couple"
          required
          value={coupleNames}
          onChange={(e) => setCoupleNames(e.target.value)}
          placeholder="Alex & Jordan"
        />

        <label htmlFor="date">Wedding date (optional)</label>
        <input
          id="date"
          type="date"
          value={weddingDate}
          onChange={(e) => setWeddingDate(e.target.value)}
        />

        <label htmlFor="message">Message (optional)</label>
        <textarea
          id="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button type="submit" className="btn btn-primary" disabled={busy}>
          Submit request
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}
      <Link className="auth-page__back" to="/">
        Back home
      </Link>
    </div>
  );
}
