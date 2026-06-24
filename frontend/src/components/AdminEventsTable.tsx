import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../api/client";
import { useTranslation } from "../i18n";
import type { AdminEventSummary } from "../types";
import "../styles/AdminEventsTable.scss";

type StatusFilter = "all" | "draft" | "active" | "closed";
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

function formatDate(value: string | null | undefined, emDash: string): string {
  if (!value) {
    return emDash;
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, emDash: string): string {
  if (!value) {
    return emDash;
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
  const { t, tPath } = useTranslation("admin.events");
  const { tPath: tStatus } = useTranslation("events.common.status");
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
      rows = rows.filter((event) => event.unindexed_photo_count > 0 && event.status !== "closed");
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
      { draft: 0, active: 0, closed: 0 },
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
    return <p className="admin-events__empty">{tPath("empty")}</p>;
  }

  const openMenuEvent = openMenuEventId ? events.find((event) => event.id === openMenuEventId) : undefined;
  const openMenuIsIndexing = openMenuEvent ? indexingEventId === openMenuEvent.id : false;
  const openMenuCanIndex = Boolean(openMenuEvent && onIndexFaces && openMenuEvent.gallery_photo_count > 0);

  return (
    <div className="admin-events" id="admin-events-table">
      {attentionFilter && (
        <div className="admin-events__attention-banner">
          <span>
            {attentionFilter === "empty_album" && tPath("attention.emptyAlbum")}
            {attentionFilter === "unindexed" && tPath("attention.unindexed")}
            {attentionFilter === "archive_due" && tPath("attention.archiveDue")}
          </span>
          {onClearAttentionFilter && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearAttentionFilter}>
              {tPath("attention.clearFilter")}
            </button>
          )}
        </div>
      )}

      <div className="admin-events__toolbar">
        <input
          type="search"
          className="admin-events__search"
          placeholder={tPath("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={tPath("searchAria")}
        />

        <div className="admin-events__filters" role="tablist" aria-label={tPath("filterAria")}>
          {(
            [
              ["all", tPath("filters.all", { count: events.length })],
              ["draft", tPath("filters.draft", { count: statusCounts.draft })],
              ["active", tPath("filters.active", { count: statusCounts.active })],
              ["closed", tPath("filters.closed", { count: statusCounts.closed })],
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
          <span>{tPath("sortLabel")}</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="created">{tPath("sort.created")}</option>
            <option value="title">{tPath("sort.title")}</option>
            <option value="wedding">{tPath("sort.wedding")}</option>
            <option value="photos">{tPath("sort.photos")}</option>
            <option value="searches">{tPath("sort.searches")}</option>
            <option value="activity">{tPath("sort.activity")}</option>
          </select>
        </label>
      </div>

      <p className="admin-events__count">
        {tPath("showing", { shown: filtered.length, total: events.length })}
      </p>

      <div className="admin-events__table-wrap">
        <table className="admin-events__table">
          <thead>
            <tr>
              <th scope="col">{tPath("columns.studio")}</th>
              <th scope="col">{tPath("columns.event")}</th>
              <th scope="col">{tPath("columns.status")}</th>
              <th scope="col">{tPath("columns.wedding")}</th>
              <th scope="col">{tPath("columns.photos")}</th>
              <th scope="col">{tPath("columns.index")}</th>
              <th scope="col">{tPath("columns.searches")}</th>
              <th scope="col">{tPath("columns.guests")}</th>
              <th scope="col">{tPath("columns.lastSearch")}</th>
              <th scope="col">{tPath("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="admin-events__no-results">
                  {tPath("noResults")}
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
                    <td>{event.organization_name ?? t("emDash")}</td>
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
                        <option value="draft">{tStatus("draft")}</option>
                        <option value="active">{tStatus("active")}</option>
                        <option value="closed">{tStatus("closed")}</option>
                      </select>
                      {event.archive_due && event.status !== "closed" && (
                        <span className="admin-events__archive-badge">{tPath("archiveBadge")}</span>
                      )}
                    </td>
                    <td>{formatDate(event.wedding_date, t("emDash"))}</td>
                    <td>{event.gallery_photo_count}</td>
                    <td>
                      {event.gallery_photo_count === 0 ? (
                        t("emDash")
                      ) : event.unindexed_photo_count > 0 ? (
                        <span className="admin-events__index-warn">
                          {tPath("indexPending", { count: event.unindexed_photo_count })}
                        </span>
                      ) : (
                        <span className="admin-events__index-ok">{tPath("indexOk")}</span>
                      )}
                    </td>
                    <td>{event.match_run_count}</td>
                    <td>{event.unique_guest_sessions}</td>
                    <td>{formatDateTime(event.last_match_at, t("emDash"))}</td>
                    <td className="admin-events__actions-cell">
                      {showInviteForm ? (
                        <form
                          className="admin-events__invite-form"
                          onSubmit={(eventForm) => handleInviteSubmit(eventForm, event.id)}
                        >
                          <input
                            type="email"
                            required
                            placeholder={tPath("adminEmailPlaceholder")}
                            value={inviteEmail}
                            disabled={busy}
                            onChange={(changeEvent) => setInviteEmail(changeEvent.target.value)}
                            aria-label={`Admin email for ${event.title}`}
                          />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                            {t("invite")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={cancelInvite}
                          >
                            {t("cancel")}
                          </button>
                        </form>
                      ) : (
                        <div className="admin-events__actions">
                          <Link className="btn btn-secondary btn-sm" to={`/e/${event.slug}/manage`}>
                            {tPath("manage")}
                          </Link>
                          <a className="btn btn-ghost btn-sm" href={buildEventGuestUrl(event.slug)}>
                            {tPath("guest")}
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
                              {tPath("more")}
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
                {openMenuIsIndexing ? t("indexing") : tPath("indexFaces")}
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
                {tPath("inviteAdmin")}
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
                {tPath("deleteEvent")}
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
