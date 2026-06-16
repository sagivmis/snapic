import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAdminEvent,
  fetchAdminAttention,
  fetchAdminEvents,
  fetchAdminStats,
  fetchSignupRequests,
  reviewSignupRequest,
  updateAdminEvent,
} from "../api/client";
import { AdminAttentionStrip, type AttentionFocus } from "../components/AdminAttentionStrip";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [weddingDate, setWeddingDate] = useState("");

  const [signupTab, setSignupTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [attentionFilter, setAttentionFilter] = useState<EventAttentionFilter>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const [statsRow, attentionRow, eventRows, requestRows] = await Promise.all([
        fetchAdminStats(token),
        fetchAdminAttention(token),
        fetchAdminEvents(token),
        fetchSignupRequests(token),
      ]);
      setStats(statsRow);
      setAttention(attentionRow);
      setEvents(eventRows);
      setRequests(requestRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
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

  if (loading) {
    return (
      <div className="admin admin--loading">
        <span className="spinner spinner-lg" />
      </div>
    );
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

      <section className="admin__stats">
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

      {attention && <AdminAttentionStrip attention={attention} onFocus={handleAttentionFocus} />}

      <form className="admin__section" onSubmit={handleCreateEvent}>
        <h2>Create event</h2>
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

      <AdminSignupRequests
        requests={requests}
        events={events}
        busy={busy}
        initialTab={signupTab}
        onReview={handleSignupReview}
      />

      <section className="admin__section">
        <h2>Events</h2>
        <AdminEventsTable
          events={events}
          busy={busy}
          attentionFilter={attentionFilter}
          onClearAttentionFilter={() => setAttentionFilter(null)}
          onStatusChange={handleStatusChange}
        />
      </section>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
