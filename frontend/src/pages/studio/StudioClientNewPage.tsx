import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createStudioClient } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import "../../styles/StudioLayout.scss";

const NEXT_STEPS = [
  {
    title: "Upload photos",
    detail: "Batch-upload from your computer.",
  },
  {
    title: "Index faces",
    detail: "Guest search builds automatically.",
  },
  {
    title: "Go live or hand off",
    detail: "Publish or invite the couple to review.",
  },
] as const;

export function StudioClientNewPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
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
        throw new Error("Not signed in");
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
      navigate(`/studio/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-page studio-client-new">
      <header className="studio-client-new__header">
        <div className="studio-client-new__header-row">
          <Link to="/studio/clients" className="studio-client-new__back">
            ← Clients
          </Link>
          <p className="studio-client-new__eyebrow">New client</p>
        </div>
        <h1>Create a gallery</h1>
      </header>

      <ol className="studio-client-new__steps" aria-label="What happens next">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.title} className="studio-client-new__step">
            <span className="studio-client-new__step-num" aria-hidden="true">
              {index + 1}
            </span>
            <span className="studio-client-new__step-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="studio-client-new__form-card">
        <form className="studio-form studio-client-new__form" onSubmit={handleSubmit}>
          <div className="studio-client-new__form-body">
            <div className="studio-client-new__fields">
              <div className="studio-client-new__section">
                <h2>About the couple</h2>

                <label htmlFor="names">Couple names</label>
                <input
                  id="names"
                  required
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  placeholder="Sarah & James"
                  autoComplete="off"
                />

                <label htmlFor="date">Wedding date</label>
                <input
                  id="date"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </div>

              <div className="studio-client-new__section">
                <h2>Optional</h2>

                <label htmlFor="email">Couple email</label>
                <input
                  id="email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="couple@example.com"
                  autoComplete="email"
                />

                <label htmlFor="notes">Internal notes</label>
                <textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Venue, package, delivery deadline…"
                />
              </div>
            </div>
          </div>

          <div className="studio-client-new__actions">
            <Link to="/studio/clients" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create gallery"}
            </button>
          </div>
        </form>
        {error && <p className="error-banner">{error}</p>}
      </section>
    </div>
  );
}
