import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildEventGuestUrl,
  createAdminEvent,
  fetchAdminEvents,
  fetchAdminStats,
  fetchSignupRequests,
  reviewSignupRequest,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type { EventPublic, SignupRequest } from "../types";
import "../styles/AdminDashboard.scss";

const CREATE_NEW_EVENT = "";

export function AdminDashboardPage() {
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState({ events_count: 0, pending_requests: 0, total_gallery_photos: 0, total_match_runs: 0 });
  const [events, setEvents] = useState<EventPublic[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [approvePlan, setApprovePlan] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const [statsRow, eventRows, requestRows] = await Promise.all([
        fetchAdminStats(token),
        fetchAdminEvents(token),
        fetchSignupRequests(token),
      ]);
      setStats(statsRow);
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

  async function handleReview(requestId: string, action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const linkedEventId = approvePlan[requestId];
      const extra =
        action === "approve" && linkedEventId
          ? { event_id: linkedEventId }
          : undefined;
      await reviewSignupRequest(requestId, action, token, extra);
      setApprovePlan((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
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

      <section className="admin__section">
        <h2>Signup requests</h2>
        {requests.filter((r) => r.status === "pending").length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <ul className="admin__list">
            {requests
              .filter((r) => r.status === "pending")
              .map((req) => (
                <li key={req.id} className="admin__list-item">
                  <div>
                    <strong>{req.couple_names}</strong>
                    <span>{req.email}</span>
                    {req.message && <p>{req.message}</p>}
                  </div>
                  <div className="admin__approve-plan">
                    <label htmlFor={`approve-event-${req.id}`}>On approve</label>
                    <select
                      id={`approve-event-${req.id}`}
                      value={approvePlan[req.id] ?? CREATE_NEW_EVENT}
                      disabled={busy}
                      onChange={(event) =>
                        setApprovePlan((prev) => ({
                          ...prev,
                          [req.id]: event.target.value,
                        }))
                      }
                    >
                      <option value={CREATE_NEW_EVENT}>Create new event</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          Link to {ev.title} (/e/{ev.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void handleReview(req.id, "approve")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void handleReview(req.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="admin__section">
        <h2>Events</h2>
        {events.length === 0 ? (
          <p>No events yet.</p>
        ) : (
          <ul className="admin__list">
            {events.map((ev) => (
              <li key={ev.id} className="admin__list-item">
                <div>
                  <strong>{ev.title}</strong>
                  <span>
                    {ev.status} · /e/{ev.slug}
                  </span>
                </div>
                <div className="admin__actions">
                  <Link className="btn btn-secondary" to={`/e/${ev.slug}/manage`}>
                    Manage
                  </Link>
                  <a className="btn btn-ghost" href={buildEventGuestUrl(ev.slug)}>
                    Guest link
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
