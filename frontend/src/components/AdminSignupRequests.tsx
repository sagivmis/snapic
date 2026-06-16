import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminEventSummary, SignupRequest } from "../types";
import "../styles/AdminSignupRequests.scss";

const CREATE_NEW_EVENT = "";

type SignupTab = "pending" | "approved" | "rejected";

interface AdminSignupRequestsProps {
  requests: SignupRequest[];
  events: AdminEventSummary[];
  busy?: boolean;
  initialTab?: SignupTab;
  onReview: (
    requestId: string,
    action: "approve" | "reject",
    linkedEventId?: string,
  ) => void | Promise<void>;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventForRequest(events: AdminEventSummary[], eventId?: string | null): AdminEventSummary | undefined {
  if (!eventId) {
    return undefined;
  }
  return events.find((event) => event.id === eventId);
}

export function AdminSignupRequests({
  requests,
  events,
  busy = false,
  initialTab = "pending",
  onReview,
}: AdminSignupRequestsProps) {
  const [tab, setTab] = useState<SignupTab>(initialTab);
  const [approvePlan, setApprovePlan] = useState<Record<string, string>>({});

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      approved: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
    }),
    [requests],
  );

  const visible = useMemo(
    () => requests.filter((request) => request.status === tab),
    [requests, tab],
  );

  async function handleReview(requestId: string, action: "approve" | "reject") {
    const linkedEventId = approvePlan[requestId];
    await onReview(requestId, action, action === "approve" && linkedEventId ? linkedEventId : undefined);
    setApprovePlan((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  }

  return (
    <section className="admin-signups admin__section" id="admin-signup-requests">
      <div className="admin-signups__header">
        <h2>Signup requests</h2>
        <div className="admin-signups__tabs" role="tablist" aria-label="Signup request status">
          {(
            [
              ["pending", `Pending (${counts.pending})`],
              ["approved", `Approved (${counts.approved})`],
              ["rejected", `Rejected (${counts.rejected})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`admin-signups__tab${tab === value ? " admin-signups__tab--active" : ""}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="admin-signups__empty">No {tab} requests.</p>
      ) : (
        <ul className="admin-signups__list">
          {visible.map((req) => {
            const linkedEvent = eventForRequest(events, req.created_event_id);
            return (
              <li key={req.id} className="admin-signups__item">
                <div className="admin-signups__main">
                  <strong>{req.couple_names}</strong>
                  <span className="admin-signups__email">{req.email}</span>
                  {req.wedding_date && (
                    <span className="admin-signups__meta">
                      Wedding {new Date(req.wedding_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className="admin-signups__meta">Submitted {formatDateTime(req.created_at)}</span>
                  {req.reviewed_at && tab !== "pending" && (
                    <span className="admin-signups__meta">Reviewed {formatDateTime(req.reviewed_at)}</span>
                  )}
                  {req.message && <p className="admin-signups__message">{req.message}</p>}
                  {linkedEvent && (
                    <p className="admin-signups__linked">
                      Linked event:{" "}
                      <Link to={`/e/${linkedEvent.slug}/manage`}>{linkedEvent.title}</Link>
                      <span className="admin-signups__slug">/e/{linkedEvent.slug}</span>
                    </p>
                  )}
                </div>

                {tab === "pending" && (
                  <>
                    <div className="admin-signups__approve-plan">
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
                    <div className="admin-signups__actions">
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
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
