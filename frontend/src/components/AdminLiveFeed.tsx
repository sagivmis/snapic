import type { AdminLiveFeedItem } from "../monitoring/adminLiveFeed";
import type { AdminLiveStatus } from "../hooks/useAdminRealtime";
import "../styles/AdminLiveFeed.scss";

interface AdminLiveFeedProps {
  items: AdminLiveFeedItem[];
  status: AdminLiveStatus;
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function statusLabel(status: AdminLiveStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "connecting":
      return "Connecting…";
    default:
      return "Offline";
  }
}

export function AdminLiveFeed({ items, status }: AdminLiveFeedProps) {
  return (
    <section className="admin-live admin__section" aria-label="Live activity">
      <div className="admin-live__header">
        <h2>Live activity</h2>
        <span
          className={`admin-live__status admin-live__status--${status}`}
          title={
            status === "live"
              ? "Dashboard updates automatically when signups, searches, or admin actions occur."
              : undefined
          }
        >
          {status === "live" && <span className="admin-live__pulse" aria-hidden="true" />}
          {statusLabel(status)}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="admin-live__empty">
          {status === "live"
            ? "Watching for new signup requests, guest searches, and admin actions…"
            : "Realtime updates unavailable — refresh the page to see the latest data."}
        </p>
      ) : (
        <ul className="admin-live__list">
          {items.map((item) => (
            <li key={item.id} className="admin-live__item">
              <span className="admin-live__message">{item.message}</span>
              <time className="admin-live__time" dateTime={item.createdAt}>
                {formatRelativeTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
