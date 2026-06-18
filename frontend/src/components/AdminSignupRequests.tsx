import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../api/client";
import { SlugAvailabilityInput, type SlugCheckStatus } from "./SlugAvailabilityInput";
import type { AdminEventSummary, SignupRequest, SlugCheckResult } from "../types";
import { defaultEventTitle, slugifyEventName } from "../utils/onboarding";
import "../styles/AdminSignupRequests.scss";

const CREATE_NEW_EVENT = "";

type SignupTab = "pending" | "approved" | "rejected";

interface ApproveDraft {
  title: string;
  slug: string;
}

interface AdminSignupRequestsProps {
  requests: SignupRequest[];
  events: AdminEventSummary[];
  busy?: boolean;
  initialTab?: SignupTab;
  onReview: (
    requestId: string,
    action: "approve" | "reject",
    options?: { linkedEventId?: string; slug?: string; title?: string },
  ) => void | Promise<void>;
  onCheckSlug?: (slug: string) => Promise<SlugCheckResult>;
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

function draftForRequest(
  drafts: Record<string, ApproveDraft>,
  request: SignupRequest,
): ApproveDraft {
  return (
    drafts[request.id] ?? {
      title: defaultEventTitle(request.couple_names),
      slug: slugifyEventName(request.couple_names),
    }
  );
}

export function AdminSignupRequests({
  requests,
  events,
  busy = false,
  initialTab = "pending",
  onReview,
  onCheckSlug,
}: AdminSignupRequestsProps) {
  const [tab, setTab] = useState<SignupTab>(initialTab);
  const [approvePlan, setApprovePlan] = useState<Record<string, string>>({});
  const [approveDrafts, setApproveDrafts] = useState<Record<string, ApproveDraft>>({});
  const [slugStatuses, setSlugStatuses] = useState<Record<string, SlugCheckStatus>>({});

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

  function updateSlugStatus(requestId: string, status: SlugCheckStatus) {
    setSlugStatuses((prev) => ({ ...prev, [requestId]: status }));
  }

  async function handleReview(requestId: string, action: "approve" | "reject") {
    const linkedEventId = approvePlan[requestId];
    const request = requests.find((item) => item.id === requestId);
    const draft = request ? draftForRequest(approveDrafts, request) : null;
    const plan = approvePlan[requestId] ?? CREATE_NEW_EVENT;

    if (
      action === "approve" &&
      plan === CREATE_NEW_EVENT &&
      onCheckSlug &&
      slugStatuses[requestId] !== "available"
    ) {
      return;
    }

    await onReview(
      requestId,
      action,
      action === "approve"
        ? linkedEventId
          ? { linkedEventId }
          : draft
            ? { slug: draft.slug.trim(), title: draft.title.trim() }
            : undefined
        : undefined,
    );

    setApprovePlan((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setApproveDrafts((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    setSlugStatuses((prev) => {
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
            const plan = approvePlan[req.id] ?? CREATE_NEW_EVENT;
            const draft = draftForRequest(approveDrafts, req);
            const guestPreviewUrl = draft.slug ? buildEventGuestUrl(draft.slug) : "";
            const slugStatus = slugStatuses[req.id] ?? "idle";
            const slugNotReady =
              plan === CREATE_NEW_EVENT && Boolean(onCheckSlug) && slugStatus !== "available";

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
                        value={plan}
                        disabled={busy}
                        onChange={(event) => {
                          const value = event.target.value;
                          setApprovePlan((prev) => ({ ...prev, [req.id]: value }));
                          setSlugStatuses((prev) => {
                            const next = { ...prev };
                            delete next[req.id];
                            return next;
                          });
                          if (value === CREATE_NEW_EVENT) {
                            setApproveDrafts((prev) => ({
                              ...prev,
                              [req.id]: {
                                title: defaultEventTitle(req.couple_names),
                                slug: slugifyEventName(req.couple_names),
                              },
                            }));
                          }
                        }}
                      >
                        <option value={CREATE_NEW_EVENT}>Create new event</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            Link to {ev.title} (/e/{ev.slug})
                          </option>
                        ))}
                      </select>
                    </div>

                    {plan === CREATE_NEW_EVENT && (
                      <div className="admin-signups__preview">
                        <label htmlFor={`approve-title-${req.id}`}>Event title</label>
                        <input
                          id={`approve-title-${req.id}`}
                          value={draft.title}
                          disabled={busy}
                          onChange={(event) =>
                            setApproveDrafts((prev) => ({
                              ...prev,
                              [req.id]: { ...draft, title: event.target.value },
                            }))
                          }
                        />

                        <label htmlFor={`approve-slug-${req.id}`}>Guest URL slug</label>
                        {onCheckSlug ? (
                          <div className="admin-signups__slug-row">
                            <span>/e/</span>
                            <SlugAvailabilityInput
                              id={`approve-slug-${req.id}`}
                              value={draft.slug}
                              onChange={(slug) =>
                                setApproveDrafts((prev) => ({
                                  ...prev,
                                  [req.id]: { ...draft, slug },
                                }))
                              }
                              onCheckSlug={onCheckSlug}
                              onStatusChange={(status) => updateSlugStatus(req.id, status)}
                              disabled={busy}
                              placeholder="smith-wedding"
                            />
                          </div>
                        ) : (
                          <div className="admin-signups__slug-row">
                            <span>/e/</span>
                            <input
                              id={`approve-slug-${req.id}`}
                              value={draft.slug}
                              disabled={busy}
                              onChange={(event) =>
                                setApproveDrafts((prev) => ({
                                  ...prev,
                                  [req.id]: {
                                    ...draft,
                                    slug: slugifyEventName(event.target.value),
                                  },
                                }))
                              }
                            />
                          </div>
                        )}

                        {guestPreviewUrl && slugStatus === "available" && (
                          <p className="admin-signups__preview-links">
                            Guest page: <a href={guestPreviewUrl}>{guestPreviewUrl}</a>
                            <br />
                            Setup: <code>/e/{draft.slug}/setup</code>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="admin-signups__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          busy ||
                          slugNotReady ||
                          (plan === CREATE_NEW_EVENT && (!draft.title.trim() || !draft.slug.trim()))
                        }
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
