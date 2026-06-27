import { FormEvent, useEffect, useState } from "react";
import { updateStudioClient } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "../../i18n";
import { clearStudioDashboardCache } from "../../lib/studioCache";
import type { StudioClient } from "../../types";

interface ClientDetailsPanelProps {
  client: StudioClient;
  onUpdated: (client: StudioClient) => void;
  onError: (message: string | null) => void;
}

export function ClientDetailsPanel({ client, onUpdated, onError }: ClientDetailsPanelProps) {
  const { getAccessToken } = useAuth();
  const { t, tPath } = useTranslation("studio.clientDetail.details");
  const [title, setTitle] = useState(client.title);
  const [coupleNames, setCoupleNames] = useState(
    typeof client.branding?.couple_names === "string" ? client.branding.couple_names : "",
  );
  const [weddingDate, setWeddingDate] = useState(client.wedding_date ?? "");
  const [clientEmail, setClientEmail] = useState(client.client_email ?? "");
  const [notes, setNotes] = useState(client.photographer_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTitle(client.title);
    setCoupleNames(typeof client.branding?.couple_names === "string" ? client.branding.couple_names : "");
    setWeddingDate(client.wedding_date ?? "");
    setClientEmail(client.client_email ?? "");
    setNotes(client.photographer_notes ?? "");
  }, [client]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSuccess(null);
    onError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const branding = { ...(client.branding ?? {}), couple_names: coupleNames.trim() || null };
      const updated = await updateStudioClient(
        client.id,
        {
          title: title.trim(),
          wedding_date: weddingDate || null,
          client_email: clientEmail.trim() || null,
          photographer_notes: notes.trim() || null,
          branding,
        },
        token,
      );
      clearStudioDashboardCache();
      onUpdated(updated);
      setSuccess(tPath("saved"));
    } catch (err) {
      onError(err instanceof Error ? err.message : tPath("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseGallery() {
    if (client.status === "closed") {
      return;
    }
    if (!window.confirm(tPath("closeConfirm", { title: client.title }))) {
      return;
    }
    setBusy(true);
    setSuccess(null);
    onError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await updateStudioClient(client.id, { status: "closed" }, token);
      clearStudioDashboardCache();
      onUpdated(updated);
      setSuccess(tPath("closed"));
    } catch (err) {
      onError(err instanceof Error ? err.message : tPath("closeFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="studio-details">
      <form className="studio-form" onSubmit={handleSubmit}>
        <label htmlFor="client-title">{tPath("titleLabel")}</label>
        <input id="client-title" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label htmlFor="couple-names">{tPath("coupleNamesLabel")}</label>
        <input id="couple-names" value={coupleNames} onChange={(e) => setCoupleNames(e.target.value)} />

        <label htmlFor="wedding-date">{tPath("weddingDateLabel")}</label>
        <input id="wedding-date" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />

        <label htmlFor="client-email">{tPath("clientEmailLabel")}</label>
        <input
          id="client-email"
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder={tPath("clientEmailPlaceholder")}
        />

        <label htmlFor="photographer-notes">{tPath("notesLabel")}</label>
        <textarea
          id="photographer-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={tPath("notesPlaceholder")}
        />

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t("saving") : t("save")}
        </button>
      </form>

      {client.status !== "closed" && (
        <div className="studio-details__danger">
          <h3>{tPath("closeTitle")}</h3>
          <p>{tPath("closeHint")}</p>
          <button type="button" className="btn btn-ghost studio-clients-table__delete-btn" disabled={busy} onClick={() => void handleCloseGallery()}>
            {tPath("closeGallery")}
          </button>
        </div>
      )}

      {success && <p className="success-banner">{success}</p>}
    </section>
  );
}
