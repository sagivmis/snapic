import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createStudioClient } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import "../../styles/StudioLayout.scss";

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
    <div className="studio-page">
      <h1>New client gallery</h1>
      <form className="studio-form" onSubmit={handleSubmit}>
        <label htmlFor="names">Couple names</label>
        <input id="names" required value={coupleNames} onChange={(e) => setCoupleNames(e.target.value)} />

        <label htmlFor="date">Wedding date</label>
        <input id="date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />

        <label htmlFor="email">Couple email (optional)</label>
        <input id="email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />

        <label htmlFor="notes">Internal notes</label>
        <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <button type="submit" className="btn btn-primary" disabled={busy}>
          Create gallery
        </button>
      </form>
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
