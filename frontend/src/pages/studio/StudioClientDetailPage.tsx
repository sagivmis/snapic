import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteStudioClient,
  fetchEventBySlug,
  fetchStudioClient,
  studioClientToEventPublic,
  studioGoLive,
  studioInviteCouple,
} from "../../api/client";
import { AlbumManager } from "../../components/shared/AlbumManager";
import { ClientAssigneesPanel } from "../../components/studio/ClientAssigneesPanel";
import { ClientDetailsPanel } from "../../components/studio/ClientDetailsPanel";
import { ClientHandoffPanel } from "../../components/studio/ClientHandoffPanel";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { StudioClientDetailSkeleton } from "../../components/studio/StudioSkeletons";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "../../i18n";
import { clearStudioDashboardCache } from "../../lib/studioCache";
import type { EventPublic, StudioClient } from "../../types";
import "../../styles/StudioLayout.scss";

type ClientTab = "album" | "handoff" | "details" | "analytics";

const TAB_KEYS: ClientTab[] = ["album", "handoff", "details", "analytics"];

export function StudioClientDetailPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { getAccessToken, isSuperAdmin } = useAuth();
  const { organization, memberRole } = useStudioOrg();
  const { t, tPath } = useTranslation("studio.clientDetail");
  const [client, setClient] = useState<StudioClient | null>(null);
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [tab, setTab] = useState<ClientTab>("album");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const associateScope = organization?.settings?.associate_scope === "event" ? "event" : "org";
  const showAssignees = (isSuperAdmin || memberRole === "owner") && associateScope === "event";

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token || !eventId) {
      setLoading(false);
      return;
    }
    try {
      const clientRow = await fetchStudioClient(eventId, token);
      setClient(clientRow);
      try {
        setEvent(await fetchEventBySlug(clientRow.slug, token));
      } catch {
        setEvent(studioClientToEventPublic(clientRow));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, getAccessToken, tPath]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(email: string) {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
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
        throw new Error(t("notSignedIn"));
      }
      await studioGoLive(eventId, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("goLiveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!client) {
      return;
    }
    if (!window.confirm(tPath("deleteConfirm", { title: client.title }))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await deleteStudioClient(eventId, token);
      clearStudioDashboardCache();
      navigate("/studio/clients", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="studio-page" aria-busy="true" aria-label={t("loadingClient")}>
        <header className="studio-page__header">
          <div>
            <p>
              <Link to="/studio/clients">{tPath("clientsBreadcrumb")}</Link>
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
        {!error && <p>{tPath("notFound")}</p>}
      </div>
    );
  }

  return (
    <div className="studio-page">
      <header className="studio-page__header">
        <div>
          <p>
            <Link to="/studio/clients">{tPath("clientsBreadcrumb")}</Link>
          </p>
          <h1>{client.title}</h1>
          <p>
            {client.status} · {client.handoff_status}
          </p>
        </div>
        <div className="studio-page__header-actions">
          <Link className="btn btn-secondary" to={`/e/${client.slug}/manage?from=studio&tab=album`}>
            {tPath("fullManagePage")}
          </Link>
          <button
            type="button"
            className="btn btn-ghost studio-clients-table__delete-btn"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            {tPath("deleteClient")}
          </button>
        </div>
      </header>

      <nav className="event-manage__tabs">
        {TAB_KEYS.map((item) => (
          <button
            key={item}
            type="button"
            className={`event-manage__tab${tab === item ? " event-manage__tab--active" : ""}`}
            onClick={() => setTab(item)}
          >
            {tPath(`tabs.${item}`)}
          </button>
        ))}
      </nav>

      {tab === "album" && event && <AlbumManager event={event} manageFrom="studio" />}
      {tab === "handoff" && (
        <ClientHandoffPanel client={client} onInvite={handleInvite} onGoLive={handleGoLive} busy={busy} />
      )}
      {tab === "details" && (
        <>
          <ClientDetailsPanel
            client={client}
            onUpdated={(updated) => {
              setClient(updated);
              if (event) {
                setEvent({
                  ...event,
                  title: updated.title,
                  wedding_date: updated.wedding_date,
                  status: updated.status,
                  branding: updated.branding ?? {},
                });
              }
            }}
            onError={setError}
          />
          {showAssignees && <ClientAssigneesPanel eventId={client.id} />}
        </>
      )}
      {tab === "analytics" && (
        <section>
          <div className="studio-page__stats">
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.match_run_count}</span>
              <span className="studio-page__stat-label">{tPath("stats.searches")}</span>
            </div>
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.unique_guest_sessions}</span>
              <span className="studio-page__stat-label">{tPath("stats.uniqueGuests")}</span>
            </div>
            <div className="studio-page__stat">
              <span className="studio-page__stat-value">{client.gallery_photo_count}</span>
              <span className="studio-page__stat-label">{tPath("stats.photos")}</span>
            </div>
          </div>
        </section>
      )}

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
