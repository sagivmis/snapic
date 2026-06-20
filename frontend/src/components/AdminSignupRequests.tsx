import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../api/client";
import { SlugAvailabilityInput, type SlugCheckStatus } from "./SlugAvailabilityInput";
import type { AdminEventSummary, SignupRequest, SlugCheckResult } from "../types";
import { defaultEventTitle, slugifyEventName } from "../utils/onboarding";
import "../styles/AdminSignupRequests.scss";

const CREATE_NEW_EVENT = "";
const SWIPE_THRESHOLD_PX = 48;

type SignupTab = "pending" | "approved" | "rejected";
type SignupViewMode = "grid" | "single";

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

function formatWeddingDate(value?: string | null): string {
  if (!value) {
    return "Date TBD";
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function NavChevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg className="admin-signups__nav-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {direction === "prev" ? (
        <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      ) : (
        <path d="m7.5 15 5-5-5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="admin-signups__view-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SingleIcon() {
  return (
    <svg className="admin-signups__view-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
  const [viewMode, setViewMode] = useState<SignupViewMode>("single");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
  const [mobilePeekId, setMobilePeekId] = useState<string | null>(null);
  const [approvePlan, setApprovePlan] = useState<Record<string, string>>({});
  const [approveDrafts, setApproveDrafts] = useState<Record<string, ApproveDraft>>({});
  const [slugStatuses, setSlugStatuses] = useState<Record<string, SlugCheckStatus>>({});
  const [finePointer, setFinePointer] = useState(true);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setActiveIndex(0);
    setSelectedGridId(null);
    setMobilePeekId(null);
  }, [tab]);

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

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, visible.length - 1)));
    setSelectedGridId((id) => (id && visible.some((row) => row.id === id) ? id : null));
    setMobilePeekId((id) => (id && visible.some((row) => row.id === id) ? id : null));
  }, [visible]);

  const showPager = visible.length > 1 && viewMode === "single";
  const activeRequest = visible[activeIndex];
  const selectedGridRequest = visible.find((row) => row.id === selectedGridId) ?? null;
  const mobilePeekRequest = visible.find((row) => row.id === mobilePeekId) ?? null;

  const goPrev = useCallback(() => {
    setActiveIndex((index) => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((index) => Math.min(visible.length - 1, index + 1));
  }, [visible.length]);

  function updateSlugStatus(requestId: string, status: SlugCheckStatus) {
    setSlugStatuses((prev) => ({ ...prev, [requestId]: status }));
  }

  function handleGridTileClick(requestId: string) {
    if (finePointer) {
      setSelectedGridId(requestId);
      setMobilePeekId(null);
      return;
    }
    setSelectedGridId(null);
    setMobilePeekId(requestId);
  }

  function handleGridReviewSelect(requestId: string) {
    setSelectedGridId(requestId);
    setMobilePeekId(null);
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

  function handleSwipeStart(clientX: number) {
    swipeStartX.current = clientX;
  }

  function handleSwipeEnd(clientX: number) {
    if (swipeStartX.current === null || !showPager) {
      return;
    }
    const delta = clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD_PX) {
      goNext();
    } else if (delta >= SWIPE_THRESHOLD_PX) {
      goPrev();
    }
  }

  function renderRequestTooltip(req: SignupRequest): ReactNode {
    const linkedEvent = eventForRequest(events, req.created_event_id);
    return (
      <>
        <strong>{req.couple_names}</strong>
        <span>{req.email}</span>
        {req.wedding_date && <span>Wedding {formatWeddingDate(req.wedding_date)}</span>}
        <span>Submitted {formatDateTime(req.created_at)}</span>
        {req.reviewed_at && tab !== "pending" && (
          <span>Reviewed {formatDateTime(req.reviewed_at)}</span>
        )}
        {req.message && <span className="admin-signups__grid-tooltip-message">{req.message}</span>}
        {linkedEvent && (
          <span>
            Linked: {linkedEvent.title} (/e/{linkedEvent.slug})
          </span>
        )}
      </>
    );
  }

  function renderRequestBody(req: SignupRequest): ReactNode {
    const linkedEvent = eventForRequest(events, req.created_event_id);
    const plan = approvePlan[req.id] ?? CREATE_NEW_EVENT;
    const draft = draftForRequest(approveDrafts, req);
    const guestPreviewUrl = draft.slug ? buildEventGuestUrl(draft.slug) : "";
    const slugStatus = slugStatuses[req.id] ?? "idle";
    const slugNotReady =
      plan === CREATE_NEW_EVENT && Boolean(onCheckSlug) && slugStatus !== "available";

    return (
      <>
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
      </>
    );
  }

  function renderRequestCard(req: SignupRequest, className = "admin-signups__item"): ReactNode {
    return (
      <li key={req.id} className={className}>
        {renderRequestBody(req)}
      </li>
    );
  }

  function renderGridView() {
    return (
      <div className="admin-signups__grid-layout">
        <div className="admin-signups__grid" role="list">
          {visible.map((req) => {
            const isSelected = selectedGridId === req.id;
            const isPeek = mobilePeekId === req.id;
            return (
              <button
                key={req.id}
                type="button"
                role="listitem"
                className={`admin-signups__grid-tile${isSelected ? " admin-signups__grid-tile--selected" : ""}${
                  isPeek ? " admin-signups__grid-tile--peek" : ""
                }`}
                aria-pressed={isSelected}
                onClick={() => handleGridTileClick(req.id)}
              >
                <span className="admin-signups__grid-date">{formatWeddingDate(req.wedding_date)}</span>
                <span className="admin-signups__grid-names">{req.couple_names}</span>
                <span className="admin-signups__grid-tooltip" role="tooltip">
                  {renderRequestTooltip(req)}
                </span>
              </button>
            );
          })}
        </div>

        {!finePointer && mobilePeekRequest && !selectedGridRequest && (
          <div className="admin-signups__grid-peek" aria-live="polite">
            <div className="admin-signups__grid-peek-body">{renderRequestTooltip(mobilePeekRequest)}</div>
            <button
              type="button"
              className="btn btn-primary admin-signups__grid-peek-review"
              onClick={() => handleGridReviewSelect(mobilePeekRequest.id)}
            >
              Review
            </button>
          </div>
        )}

        {selectedGridRequest && (
          <div className="admin-signups__grid-detail">
            <ul className="admin-signups__list">
              {renderRequestCard(selectedGridRequest, "admin-signups__item admin-signups__item--panel")}
            </ul>
          </div>
        )}

        {!selectedGridRequest && finePointer && visible.length > 0 && (
          <p className="admin-signups__grid-hint">Click a card to review. Hover for details.</p>
        )}
        {!selectedGridRequest && !finePointer && !mobilePeekRequest && visible.length > 0 && (
          <p className="admin-signups__grid-hint">Tap a card for details, then tap Review.</p>
        )}
      </div>
    );
  }

  function renderSingleView() {
    if (showPager) {
      return (
        <div className="admin-signups__carousel">
          <div className="admin-signups__pager" aria-live="polite">
            <button
              type="button"
              className="admin-signups__nav"
              disabled={activeIndex === 0}
              aria-label="Previous request"
              onClick={goPrev}
            >
              <NavChevron direction="prev" />
            </button>
            <span className="admin-signups__pager-label">
              Request {activeIndex + 1} of {visible.length}
            </span>
            <button
              type="button"
              className="admin-signups__nav"
              disabled={activeIndex >= visible.length - 1}
              aria-label="Next request"
              onClick={goNext}
            >
              <NavChevron direction="next" />
            </button>
          </div>

          <ul
            className="admin-signups__list admin-signups__list--single"
            onPointerDown={(event) => handleSwipeStart(event.clientX)}
            onPointerUp={(event) => handleSwipeEnd(event.clientX)}
            onPointerCancel={() => {
              swipeStartX.current = null;
            }}
          >
            {activeRequest ? renderRequestCard(activeRequest) : null}
          </ul>
        </div>
      );
    }

    return (
      <ul className="admin-signups__list">{activeRequest ? renderRequestCard(activeRequest) : null}</ul>
    );
  }

  return (
    <section className="admin-signups admin__section" id="admin-signup-requests">
      <div className="admin-signups__header">
        <h2>Signup requests</h2>
        <div className="admin-signups__header-controls">
          <div className="admin-signups__view-toggle" role="group" aria-label="Signup request layout">
            <button
              type="button"
              className={`admin-signups__view-btn${viewMode === "grid" ? " admin-signups__view-btn--active" : ""}`}
              aria-pressed={viewMode === "grid"}
              title="Grid view"
              onClick={() => setViewMode("grid")}
            >
              <GridIcon />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className={`admin-signups__view-btn${viewMode === "single" ? " admin-signups__view-btn--active" : ""}`}
              aria-pressed={viewMode === "single"}
              title="Single view"
              onClick={() => setViewMode("single")}
            >
              <SingleIcon />
              <span>Single</span>
            </button>
          </div>
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
      </div>

      {visible.length === 0 ? (
        <p className="admin-signups__empty">No {tab} requests.</p>
      ) : viewMode === "grid" ? (
        renderGridView()
      ) : (
        renderSingleView()
      )}
    </section>
  );
}
