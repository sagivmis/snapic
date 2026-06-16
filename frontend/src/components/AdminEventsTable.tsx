import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildEventGuestUrl } from "../api/client";
import type { AdminEventSummary } from "../types";
import "../styles/AdminEventsTable.scss";

type StatusFilter = "all" | "draft" | "active" | "archived";
type SortKey = "created" | "title" | "wedding" | "photos" | "searches" | "activity";

interface AdminEventsTableProps {
  events: AdminEventSummary[];
  busy?: boolean;
  onStatusChange: (eventId: string, status: AdminEventSummary["status"]) => void | Promise<void>;
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

export function AdminEventsTable({ events, busy = false, onStatusChange }: AdminEventsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let rows = events;

    if (statusFilter !== "all") {
      rows = rows.filter((event) => event.status === statusFilter);
    }

    if (normalizedQuery) {
      rows = rows.filter((event) => eventSearchText(event).includes(normalizedQuery));
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
  }, [events, query, sortKey, statusFilter]);

  const statusCounts = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc[event.status] += 1;
        return acc;
      },
      { draft: 0, active: 0, archived: 0 },
    );
  }, [events]);

  if (events.length === 0) {
    return <p className="admin-events__empty">No events yet.</p>;
  }

  return (
    <div className="admin-events">
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
              <th scope="col">Searches</th>
              <th scope="col">Guests</th>
              <th scope="col">Last search</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-events__no-results">
                  No events match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((event) => {
                const names = coupleNames(event);
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
                    </td>
                    <td>{formatDate(event.wedding_date)}</td>
                    <td>{event.gallery_photo_count}</td>
                    <td>{event.match_run_count}</td>
                    <td>{event.unique_guest_sessions}</td>
                    <td>{formatDateTime(event.last_match_at)}</td>
                    <td>
                      <div className="admin-events__actions">
                        <Link className="btn btn-secondary btn-sm" to={`/e/${event.slug}/manage`}>
                          Manage
                        </Link>
                        <a className="btn btn-ghost btn-sm" href={buildEventGuestUrl(event.slug)}>
                          Guest
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
