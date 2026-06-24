import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAdminEvent,
  deleteAdminEvent,
  fetchAdminAttention,
  fetchAdminAuditLog,
  fetchAdminEvents,
  fetchAdminStats,
  fetchSignupRequests,
  inviteAdminEventMember,
  reindexEventGallery,
  reviewSignupRequest,
  checkAdminSlug,
  updateAdminEvent,
} from "../api/client";
import { AdminAttentionStrip, type AttentionFocus } from "../components/AdminAttentionStrip";
import { AdminAuditLog } from "../components/AdminAuditLog";
import {
  AdminAttentionSkeleton,
  AdminEventsTableSkeleton,
  AdminSignupRequestsSkeleton,
  AdminStatsSkeleton,
} from "../components/AdminDashboardSkeletons";
import { AdminEventsTable, type EventAttentionFilter } from "../components/AdminEventsTable";
import { AdminLiveFeed } from "../components/AdminLiveFeed";
import { AdminSignupRequests } from "../components/AdminSignupRequests";
import { SlugAvailabilityInput, type SlugCheckStatus } from "../components/SlugAvailabilityInput";
import { IndexFacesProgress } from "../components/IndexFacesProgress";
import { useAuth } from "../auth/AuthProvider";
import { useAdminRealtime } from "../hooks/useAdminRealtime";
import { isSupabaseConfigured } from "../lib/supabase";
import type { AdminLiveFeedItem } from "../monitoring/adminLiveFeed";
import type { AdminAttention, AdminEventSummary, AuditLogEntry, SignupRequest } from "../types";
import type { IndexStreamEvent } from "../api/client";
import { formatIndexResult } from "../utils/galleryFaceIndex";
import "../styles/AdminDashboard.scss";

export function AdminDashboardPage() {
  const { getAccessToken, isSuperAdmin, session } = useAuth();
  const [stats, setStats] = useState({
    events_count: 0,
    pending_requests: 0,
    total_gallery_photos: 0,
    total_match_runs: 0,
    organizations_count: 0,
    photographer_signups_pending: 0,
  });
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
  const [indexProgress, setIndexProgress] = useState<Extract<
    IndexStreamEvent,
    { type: "progress" }
  > | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugCheckStatus>("idle");
  const [title, setTitle] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  const [signupTab, setSignupTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [attentionFilter, setAttentionFilter] = useState<EventAttentionFilter>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [liveFeed, setLiveFeed] = useState<AdminLiveFeedItem[]>([]);
  const loadRef = useRef<
    (options?: { showSkeletons?: boolean; clearSuccess?: boolean }) => Promise<void>
  >(() => Promise.resolve());

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
        .then((statsRow) =>
          setStats({
            events_count: statsRow.events_count,
            pending_requests: statsRow.pending_requests,
            total_gallery_photos: statsRow.total_gallery_photos,
            total_match_runs: statsRow.total_match_runs,
            organizations_count: statsRow.organizations_count,
            photographer_signups_pending: statsRow.photographer_signups_pending,
          }),
        )
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

      const auditTask = fetchAdminAuditLog(token)
        .then((rows) => setAuditLog(rows))
        .catch(() => {
          failures += 1;
        })
        .finally(() => setAuditLoading(false));

      await Promise.all([statsTask, attentionTask, eventsTask, requestsTask, auditTask]);

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
      setAuditLoading(false);
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    }
  }, [getAccessToken]);

  loadRef.current = load;

  const handleLiveFeedItem = useCallback((item: AdminLiveFeedItem) => {
    setLiveFeed((current) => {
      if (current.some((row) => row.id === item.id)) {
        return current;
      }
      return [item, ...current].slice(0, 25);
    });
    if (item.id.startsWith("signup-insert-")) {
      setSignupTab("pending");
    }
  }, []);

  const handleRealtimeRefresh = useCallback(() => {
    void loadRef.current({ showSkeletons: false, clearSuccess: false });
  }, []);

  const { status: liveStatus } = useAdminRealtime({
    enabled: isSuperAdmin && isSupabaseConfigured && Boolean(session),
    onRefresh: handleRealtimeRefresh,
    onFeedItem: handleLiveFeedItem,
  });

  useEffect(() => {
    void load({ showSkeletons: true, clearSuccess: false });
  }, [load]);

  async function handleCreateEvent(eventForm: FormEvent) {
    eventForm.preventDefault();
    if (!slug.trim() || slugStatus !== "available") {
      return;
    }
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
      setSlugStatus("idle");
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
    options?: { linkedEventId?: string; slug?: string; title?: string },
  ) {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const extra =
        action === "approve"
          ? options?.linkedEventId
            ? { event_id: options.linkedEventId }
            : options?.slug || options?.title
              ? { slug: options.slug, title: options.title }
              : undefined
          : undefined;
      const reviewed = await reviewSignupRequest(requestId, action, token, extra);
      if (action === "approve" && reviewed.welcome_email_sent === false) {
        setSuccess(
          "Request approved. Supabase invite sent, but the Snapic welcome email could not be sent — check RESEND_API_KEY and SNAPIC_FROM_EMAIL on Render.",
        );
      } else if (action === "approve") {
        setSuccess("Request approved and welcome email sent.");
      } else if (action === "reject") {
        setSignupTab("rejected");
        if (reviewed.rejection_email_sent === true) {
          setSuccess("Request rejected and notification email sent.");
        } else {
          setSuccess(
            "Request rejected. The rejection email could not be sent — set RESEND_API_KEY on Render and use a verified SNAPIC_FROM_EMAIL (Resend sandbox only delivers to your account email).",
          );
        }
      }
      await load({ clearSuccess: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleIndexFaces(eventId: string) {
    const event = events.find((row) => row.id === eventId);
    setIndexingEventId(eventId);
    setIndexProgress(null);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const result = await reindexEventGallery(eventId, token, (progress) => {
        setIndexProgress(progress);
      });
      const [attentionRow, eventRows, auditRows] = await Promise.all([
        fetchAdminAttention(token),
        fetchAdminEvents(token),
        fetchAdminAuditLog(token),
      ]);
      setAttention(attentionRow);
      setEvents(eventRows);
      setAuditLog(auditRows);
      setSuccess(
        `${formatIndexResult(result)}${event ? ` for ${event.title}` : ""}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexingEventId(null);
      setIndexProgress(null);
    }
  }

  const checkCreateEventSlug = useCallback(async (slugValue: string) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Not signed in");
    }
    return checkAdminSlug(slugValue, token);
  }, [getAccessToken]);

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

      {(success || error) && (
        <div className="admin__feedback" aria-live="polite">
          {success && <p className="success-banner admin__feedback-banner">{success}</p>}
          {error && <p className="error-banner admin__feedback-banner">{error}</p>}
        </div>
      )}

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
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.organizations_count ?? 0}</span>
            <span>Studios</span>
          </div>
          <div className="admin__stat">
            <span className="admin__stat-value">{stats.photographer_signups_pending ?? 0}</span>
            <span>Photographer signups</span>
          </div>
        </section>
      )}

      <AdminLiveFeed items={liveFeed} status={liveStatus} />

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
              <SlugAvailabilityInput
                id="slug"
                value={slug}
                onChange={setSlug}
                onCheckSlug={checkCreateEventSlug}
                onStatusChange={setSlugStatus}
                disabled={busy}
                required
                placeholder="smith-wedding-2026"
              />

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

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !slug.trim() || slugStatus !== "available"}
              >
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
          onCheckSlug={checkCreateEventSlug}
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

      {indexingEventId && <IndexFacesProgress progress={indexProgress} />}

      <AdminAuditLog entries={auditLog} loading={auditLoading} />
    </div>
  );
}
