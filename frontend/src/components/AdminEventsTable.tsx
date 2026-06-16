import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../api/client";
import type { AdminEventSummary } from "../types";
import "../styles/AdminEventsTable.scss";

type StatusFilter = "all" | "draft" | "active" | "archived";
type SortKey = "created" | "title" | "wedding" | "photos" | "searches" | "activity";
export type EventAttentionFilter = "empty_album" | "unindexed" | "archive_due" | null;

interface AdminEventsTableProps {
  events: AdminEventSummary[];
  busy?: boolean;
  indexingEventId?: string | null;
  attentionFilter?: EventAttentionFilter;
  onClearAttentionFilter?: () => void;
  onStatusChange: (eventId: string, status: AdminEventSummary["status"]) => void | Promise<void>;
  onIndexFaces?: (eventId: string) => void | Promise<void>;
  onInviteAdmin?: (eventId: string, email: string) => void | Promise<void>;
  onDeleteEvent?: (eventId: string) => void | Promise<void>;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function coupleNames(event: AdminEventSummary): string | null {
  const names = event.branding?.couple_names;
  return typeof names === "string" && names.trim() ? names.trim() : null;
}

function eventSearchText(event: AdminEventSummary): string {
  return [event.title, event.slug, coupleNames(event)].filter(Boolean).join(" ").toLowerCase();
}

interface MenuAnchor {
  top: number;
  right: number;
}

export function AdminEventsTable({
  events,
  busy = false,
  indexingEventId = null,
  attentionFilter = null,
  onClearAttentionFilter,
  onStatusChange,
  onIndexFaces,
  onInviteAdmin,
  onDeleteEvent,
}: AdminEventsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [openMenuEventId, setOpenMenuEventId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [inviteEventId, setInviteEventId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  function closeMenu() {
    setOpenMenuEventId(null);
    setMenuAnchor(null);
  }

  function toggleMenu(eventId: string, button: HTMLButtonElement) {
    if (openMenuEventId === eventId) {
      closeMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenuAnchor({ top: rect.bottom + 4, right: rect.right });
    setOpenMenuEventId(eventId);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuPanelRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest("[data-admin-event-menu-trigger]")) {
        return;
      }
      closeMenu();
    }

    function handleDismiss() {
      closeMenu();
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = events;

    if (statusFilter !== "all") {
      rows = rows.filter((event) => event.status === statusFilter);
    }

    if (normalizedQuery) {
      rows = rows.filter((event) => eventSearchText(event).includes(normalizedQuery));
    }

    if (attentionFilter === "empty_album") {
      rows = rows.filter((event) => event.status === "active" && event.gallery_photo_count === 0);
    } else if (attentionFilter === "unindexed") {
      rows = rows.filter((event) => event.unindexed_photo_count > 0 && event.status !== "archived");
    } else if (attentionFilter === "archive_due") {
      rows = rows.filter((event) => event.archive_due);
    }

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title);
        case "wedding":
          return (b.wedding_date ?? "").localeCompare(a.wedding_date ?? "");
        case "photos":
          return b.gallery_photo_count - a.gallery_photo_count;
        case "searches":
          return b.match_run_count - a.match_run_count;
        case "activity":
          return (b.last_match_at ?? "").localeCompare(a.last_match_at ?? "");
        case "created":
        default:
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }
    });

    return sorted;
  }, [events, query, sortKey, statusFilter, attentionFilter]);

  const statusCounts = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc[event.status] += 1;
        return acc;
      },
      { draft: 0, active: 0, archived: 0 },
    );
  }, [events]);

  function startInvite(eventId: string) {
    closeMenu();
    setInviteEventId(eventId);
    setInviteEmail("");
  }

  function cancelInvite() {
    setInviteEventId(null);
    setInviteEmail("");
  }

  async function handleInviteSubmit(eventForm: FormEvent, eventId: string) {
    eventForm.preventDefault();
    const email = inviteEmail.trim();
    if (!email || !onInviteAdmin) {
      return;
    }
    try {
      await onInviteAdmin(eventId, email);
      cancelInvite();
    } catch {
      // Parent surfaces the error banner.
    }
  }

  if (events.length === 0) {
    return <p className="admin-events__empty">No events yet.</p>;
  }

  const openMenuEvent = openMenuEventId ? events.find((event) => event.id === openMenuEventId) : undefined;
  const openMenuIsIndexing = openMenuEvent ? indexingEventId === openMenuEvent.id : false;
  const openMenuCanIndex = Boolean(openMenuEvent && onIndexFaces && openMenuEvent.gallery_photo_count > 0);

  return (
    <div className="admin-events" id="admin-events-table">
      {attentionFilter && (
        <div className="admin-events__attention-banner">
          <span>
            {attentionFilter === "empty_album" && "Showing active events with no photos"}
            {attentionFilter === "unindexed" && "Showing events with photos needing face index"}
            {attentionFilter === "archive_due" && "Showing events past their archive date"}
          </span>
          {onClearAttentionFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearAttentionFilter}>
              Clear filter
            </button>
          )}
        </div>
      )}

      <div className="admin-events__toolbar">
        <input
          type="search"
          className="admin-events__search"
          placeholder="Search title, slug, couple…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search events"
        />

        <div className="admin-events__filters" role="tablist" aria-label="Filter by status">
          {(
            [
              ["all", `All (${events.length})`],
              ["draft", `Draft (${statusCounts.draft})`],
              ["active", `Active (${statusCounts.active})`],
              ["archived", `Archived (${statusCounts.archived})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={statusFilter === value}
              className={`admin-events__filter${statusFilter === value ? " admin-events__filter--active" : ""}`}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="admin-events__sort">
          <span>Sort</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="created">Newest first</option>
            <option value="title">Title A–Z</option>
            <option value="wedding">Wedding date</option>
            <option value="photos">Most photos</option>
            <option value="searches">Most searches</option>
            <option value="activity">Recent activity</option>
          </select>
        </label>
      </div>

      <p className="admin-events__count">
        Showing {filtered.length} of {events.length} event{events.length === 1 ? "" : "s"}
      </p>

      <div className="admin-events__table-wrap">
        <table className="admin-events__table">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Status</th>
              <th scope="col">Wedding</th>
              <th scope="col">Photos</th>
              <th scope="col">Index</th>
              <th scope="col">Searches</th>
              <th scope="col">Guests</th>
              <th scope="col">Last search</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-events__no-results">
                  No events match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((event) => {
                const names = coupleNames(event);
                const isIndexing = indexingEventId === event.id;
                const rowBusy = busy || isIndexing;
                const showInviteForm = inviteEventId === event.id;

                return (
                  <tr key={event.id}>
                    <td className="admin-events__event-cell">
                      <strong>{event.title}</strong>
                      {names && <span className="admin-events__couple">{names}</span>}
                      <span className="admin-events__slug">/e/{event.slug}</span>
                    </td>
                    <td>
                      <select
                        className={`admin-events__status admin-events__status--${event.status}`}
                        value={event.status}
                        disabled={busy}
                        aria-label={`Status for ${event.title}`}
                        onChange={(changeEvent) =>
                          void onStatusChange(
                            event.id,
                            changeEvent.target.value as AdminEventSummary["status"],
                          )
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                      {event.archive_due && event.status !== "archived" && (
                        <span className="admin-events__archive-badge">Archive due</span>
                      )}
                    </td>
                    <td>{formatDate(event.wedding_date)}</td>
                    <td>{event.gallery_photo_count}</td>
                    <td>
                      {event.gallery_photo_count === 0 ? (
                        "—"
                      ) : event.unindexed_photo_count > 0 ? (
                        <span className="admin-events__index-warn">{event.unindexed_photo_count} pending</span>
                      ) : (
                        <span className="admin-events__index-ok">Indexed</span>
                      )}
                    </td>
                    <td>{event.match_run_count}</td>
                    <td>{event.unique_guest_sessions}</td>
                    <td>{formatDateTime(event.last_match_at)}</td>
                    <td className="admin-events__actions-cell">
                      {showInviteForm ? (
                        <form
                          className="admin-events__invite-form"
                          onSubmit={(eventForm) => handleInviteSubmit(eventForm, event.id)}
                        >
                          <input
                            type="email"
                            required
                            placeholder="Admin email"
                            value={inviteEmail}
                            disabled={busy}
                            onChange={(changeEvent) => setInviteEmail(changeEvent.target.value)}
                            aria-label={`Admin email for ${event.title}`}
                          />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                            Invite
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={cancelInvite}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="admin-events__actions">
                          <Link className="btn btn-secondary btn-sm" to={`/e/${event.slug}/manage`}>
                            Manage
                          </Link>
                          <a className="btn btn-ghost btn-sm" href={buildEventGuestUrl(event.slug)}>
                            Guest
                          </a>
                          {(onIndexFaces || onInviteAdmin || onDeleteEvent) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm admin-events__menu-trigger"
                              data-admin-event-menu-trigger
                              aria-haspopup="menu"
                              aria-expanded={openMenuEventId === event.id}
                              disabled={rowBusy && openMenuEventId !== event.id}
                              onClick={(clickEvent) => toggleMenu(event.id, clickEvent.currentTarget)}
                            >
                              More
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openMenuEvent &&
        menuAnchor &&
        createPortal(
          <div
            ref={menuPanelRef}
            className="admin-events__menu-panel admin-events__menu-panel--fixed"
            role="menu"
            style={{
              top: menuAnchor.top,
              left: menuAnchor.right,
            }}
          >
            {openMenuCanIndex && (
              <button
                type="button"
                role="menuitem"
                className="admin-events__menu-item"
                disabled={openMenuIsIndexing}
                onClick={() => {
                  closeMenu();
                  void onIndexFaces?.(openMenuEvent.id);
                }}
              >
                {openMenuIsIndexing ? "Indexing…" : "Index faces"}
              </button>
            )}
            {onInviteAdmin && (
              <button
                type="button"
                role="menuitem"
                className="admin-events__menu-item"
                disabled={busy}
                onClick={() => startInvite(openMenuEvent.id)}
              >
                Invite admin
              </button>
            )}
            {onDeleteEvent && (
              <button
                type="button"
                role="menuitem"
                className="admin-events__menu-item admin-events__menu-item--danger"
                disabled={busy}
                onClick={() => {
                  closeMenu();
                  void onDeleteEvent(openMenuEvent.id);
                }}
              >
                Delete event
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
