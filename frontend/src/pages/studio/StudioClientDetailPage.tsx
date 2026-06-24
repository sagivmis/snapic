import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchEventBySlug,
  fetchStudioClient,
  studioGoLive,
  studioInviteCouple,
} from "../../api/client";
import { AlbumManager } from "../../components/shared/AlbumManager";
import { ClientHandoffPanel } from "../../components/studio/ClientHandoffPanel";
import { StudioClientDetailSkeleton } from "../../components/studio/StudioSkeletons";
import { useAuth } from "../../auth/AuthProvider";
import type { EventPublic, StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

type ClientTab = "album" | "handoff" | "analytics";

export function StudioClientDetailPage() {
  const { eventId = "" } = useParams();
  const { getAccessToken } = useAuth();
  const [client, setClient] = useState<StudioClient | null>(null);
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [tab, setTab] = useState<ClientTab>("album");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token || !eventId) {
      setLoading(false);
      return;
    }
    try {
      const clientRow = await fetchStudioClient(eventId, token);
      setClient(clientRow);
      setEvent(await fetchEventBySlug(clientRow.slug, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load client");
    } finally {
      setLoading(false);
    }
  }, [eventId, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(email: string) {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await studioInviteCouple(eventId, email, token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleGoLive() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await studioGoLive(eventId, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Go live failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="studio-page" aria-busy="true" aria-label="Loading client">
        <header className="studio-page__header">
          <div>
            <p>
              <Link to="/studio/clients">Clients</Link>
            </p>
            <h1 className="studio-skeleton studio-skeleton--title-inline" aria-hidden="true" />
          </div>
        </header>
        <StudioClientDetailSkeleton />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="studio-page">
        {error && <p className="error-banner">{error}</p>}
        {!error && <p>Client not found.</p>}
      </div>
    );
  }

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <p>
            <Link to="/studio/clients">Clients</Link>
          </p>
          <h1>{client.title}</h1>
          <p>
            {client.status} · {client.handoff_status}
          </p>
        </div>
        <Link className="btn btn-secondary" to={`/e/${client.slug}/manage?from=studio&tab=album`}>
          Full manage page
        </Link>
      </header>

      <nav className="event-manage__tabs">
        {(["album", "handoff", "analytics"] as ClientTab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`event-manage__tab${tab === item ? " event-manage__tab--active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "album" && event && <AlbumManager event={event} manageFrom="studio" />}
      {tab === "handoff" && (
        <ClientHandoffPanel client={client} onInvite={handleInvite} onGoLive={handleGoLive} busy={busy} />
      )}
      {tab === "analytics" && (
        <section>
          <div className="studio-page__stats">
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.match_run_count}</span>
              <span className="studio-page__stat-label">Searches</span>
            </div>
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.unique_guest_sessions}</span>
              <span className="studio-page__stat-label">Unique guests</span>
            </div>
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.gallery_photo_count}</span>
              <span className="studio-page__stat-label">Photos</span>
            </div>
          </div>
        </section>
      )}

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
