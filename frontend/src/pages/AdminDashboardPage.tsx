import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAdminEvent,
  deleteAdminEvent,
  fetchAdminAttention,
  fetchAdminEvents,
  fetchAdminStats,
  fetchSignupRequests,
  inviteAdminEventMember,
  reindexEventGallery,
  reviewSignupRequest,
  updateAdminEvent,
} from "../api/client";
import { AdminAttentionStrip, type AttentionFocus } from "../components/AdminAttentionStrip";
import {
  AdminAttentionSkeleton,
  AdminEventsTableSkeleton,
  AdminSignupRequestsSkeleton,
  AdminStatsSkeleton,
} from "../components/AdminDashboardSkeletons";
import { AdminEventsTable, type EventAttentionFilter } from "../components/AdminEventsTable";
import { AdminSignupRequests } from "../components/AdminSignupRequests";
import { useAuth } from "../auth/AuthProvider";
import type { AdminAttention, AdminEventSummary, SignupRequest } from "../types";
import "../styles/AdminDashboard.scss";

export function AdminDashboardPage() {
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState({ events_count: 0, pending_requests: 0, total_gallery_photos: 0, total_match_runs: 0 });
  const [attention, setAttention] = useState<AdminAttention | null>(null);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [indexingEventId, setIndexingEventId] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  const [signupTab, setSignupTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [attentionFilter, setAttentionFilter] = useState<EventAttentionFilter>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  const load = useCallback(async (options?: { showSkeletons?: boolean; clearSuccess?: boolean }) => {
    const showSkeletons = options?.showSkeletons ?? false;
    if (options?.clearSuccess !== false) {
      setSuccess(null);
    }
    setError(null);
    if (showSkeletons) {
      setStatsLoading(true);
      setAttentionLoading(true);
      setEventsLoading(true);
      setRequestsLoading(true);
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }

      let failures = 0;

      const statsTask = fetchAdminStats(token)
        .then((statsRow) => setStats(statsRow))
        .catch(() => {
          failures += 1;
        })
        .finally(() => setStatsLoading(false));

      const attentionTask = fetchAdminAttention(token)
        .then((attentionRow) => setAttention(attentionRow))
        .catch(() => {
          failures += 1;
        })
        .finally(() => setAttentionLoading(false));

      const eventsTask = fetchAdminEvents(token)
        .then((eventRows) => setEvents(eventRows))
        .catch(() => {
          failures += 1;
        })
        .finally(() => setEventsLoading(false));

      const requestsTask = fetchSignupRequests(token)
        .then((requestRows) => setRequests(requestRows))
        .catch(() => {
          failures += 1;
        })
        .finally(() => setRequestsLoading(false));

      await Promise.all([statsTask, attentionTask, eventsTask, requestsTask]);

      if (failures > 0) {
        setError(
          failures === 4
            ? "Could not load dashboard"
            : "Some dashboard sections failed to load. Try refreshing the page.",
        );
      }
    } catch (err) {
      setStatsLoading(false);
      setAttentionLoading(false);
      setEventsLoading(false);
      setRequestsLoading(false);
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load({ showSkeletons: true, clearSuccess: false });
  }, [load]);

  async function handleCreateEvent(eventForm: FormEvent) {
    eventForm.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await createAdminEvent(
        {
          slug,
          title,
          wedding_date: weddingDate || null,
          status: "draft",
          admin_email: adminEmail.trim() || null,
        },
        token,
      );
      setSlug("");
      setTitle("");
      setAdminEmail("");
      setWeddingDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(eventId: string, status: AdminEventSummary["status"]) {
    const previous = events;
    setEvents((current) =>
      current.map((event) => (event.id === eventId ? { ...event, status } : event)),
    );
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const updated = await updateAdminEvent(eventId, { status }, token);
      setEvents((current) => current.map((event) => (event.id === eventId ? updated : event)));
      const attentionRow = await fetchAdminAttention(token);
      setAttention(attentionRow);
    } catch (err) {
      setEvents(previous);
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignupReview(
    requestId: string,
    action: "approve" | "reject",
    linkedEventId?: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const extra =
        action === "approve" && linkedEventId ? { event_id: linkedEventId } : undefined;
      await reviewSignupRequest(requestId, action, token, extra);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleIndexFaces(eventId: string) {
    const event = events.find((row) => row.id === eventId);
    setIndexingEventId(eventId);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const result = await reindexEventGallery(eventId, token);
      const [attentionRow, eventRows] = await Promise.all([
        fetchAdminAttention(token),
        fetchAdminEvents(token),
      ]);
      setAttention(attentionRow);
      setEvents(eventRows);
      setSuccess(
        `Indexed faces in ${result.processed} photo${result.processed === 1 ? "" : "s"}${event ? ` for ${event.title}` : ""}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexingEventId(null);
    }
  }

  async function handleInviteAdmin(eventId: string, email: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await inviteAdminEventMember(eventId, email, token, "admin");
      setSuccess(`Invite sent to ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite admin");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const event = events.find((row) => row.id === eventId);
    if (
      !window.confirm(
        `Delete "${event?.title ?? "this event"}" permanently? Photos, searches, and storage will be removed.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await deleteAdminEvent(eventId, token);
      await load({ clearSuccess: false });
      setSuccess(`Deleted ${event?.title ?? "event"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete event");
    } finally {
      setBusy(false);
    }
  }

  function handleAttentionFocus(focus: AttentionFocus) {
    if (focus === "pending_signups") {
      setSignupTab("pending");
      document.getElementById("admin-signup-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (focus === "empty_album" || focus === "unindexed" || focus === "archive_due") {
      setAttentionFilter(focus);
      document.getElementById("admin-events-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <div>
          <p className="admin__eyebrow">Super admin</p>
          <h1>Dashboard</h1>
        </div>
        <Link to="/" className="btn btn-ghost">
          Home
        </Link>
      </header>

      {statsLoading ? (
        <AdminStatsSkeleton />
      ) : (
        <section className="admin__stats" aria-label="Dashboard stats">
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.events_count}</span>
            <span>Events</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.pending_requests}</span>
            <span>Pending requests</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.total_gallery_photos}</span>
            <span>Gallery photos</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.total_match_runs}</span>
            <span>Match runs</span>
          </div>
        </section>
      )}

      {attentionLoading ? (
        <AdminAttentionSkeleton />
      ) : (
        attention && <AdminAttentionStrip attention={attention} onFocus={handleAttentionFocus} />
      )}

      <section
        className={`admin__section admin__collapsible${createEventOpen ? " admin__collapsible--open" : ""}`}
      >
        <button
          type="button"
          className="admin__collapsible-summary"
          aria-expanded={createEventOpen}
          aria-controls="admin-create-event-panel"
          onClick={() => setCreateEventOpen((open) => !open)}
        >
          <h2>Create event</h2>
        </button>
        <div
          id="admin-create-event-panel"
          className="admin__collapsible-panel"
          aria-hidden={!createEventOpen}
          {...(!createEventOpen ? { inert: "" as const } : {})}
        >
          <div className="admin__collapsible-inner">
            <form className="admin__collapsible-body" onSubmit={handleCreateEvent}>
              <label htmlFor="slug">Slug</label>
              <input id="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="smith-wedding-2026" />

              <label htmlFor="title">Title</label>
              <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />

              <label htmlFor="admin-email">Admin email (optional)</label>
              <input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />

              <label htmlFor="wedding-date">Wedding date</label>
              <input
                id="wedding-date"
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
              />

              <button type="submit" className="btn btn-primary" disabled={busy}>
                Create event
              </button>
            </form>
          </div>
        </div>
      </section>

      {requestsLoading ? (
        <AdminSignupRequestsSkeleton />
      ) : (
        <AdminSignupRequests
          requests={requests}
          events={events}
          busy={busy}
          initialTab={signupTab}
          onReview={handleSignupReview}
        />
      )}

      <section className="admin__section">
        <h2>Events</h2>
        {eventsLoading ? (
          <AdminEventsTableSkeleton />
        ) : (
          <AdminEventsTable
            events={events}
            busy={busy}
            indexingEventId={indexingEventId}
            attentionFilter={attentionFilter}
            onClearAttentionFilter={() => setAttentionFilter(null)}
            onStatusChange={handleStatusChange}
            onIndexFaces={handleIndexFaces}
            onInviteAdmin={handleInviteAdmin}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </section>

      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
