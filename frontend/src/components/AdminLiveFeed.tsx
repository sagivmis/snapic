import { useState } from "react";
import type { AdminLiveFeedItem } from "../monitoring/adminLiveFeed";
import type { AdminLiveStatus } from "../hooks/useAdminRealtime";
import "../styles/AdminLiveFeed.scss";

const COLLAPSED_ITEM_COUNT = 2;
const MAX_VISIBLE_ITEMS = 10;
const VIEWPORT_ROW_COUNT = 3;

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

function LiveFeedRow({ item }: { item: AdminLiveFeedItem }) {
  return (
    <li className="admin-live__item">
      <span className="admin-live__message">{item.message}</span>
      <time className="admin-live__time" dateTime={item.createdAt}>
        {formatRelativeTime(item.createdAt)}
      </time>
    </li>
  );
}

export function AdminLiveFeed({ items, status }: AdminLiveFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const isSquashed = displayItems.length > VIEWPORT_ROW_COUNT;
  const hiddenCount = displayItems.length - COLLAPSED_ITEM_COUNT;
  const visibleItems = isSquashed && !expanded ? displayItems.slice(0, COLLAPSED_ITEM_COUNT) : displayItems;

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
      ) : isSquashed ? (
        <div className={`admin-live__frame${expanded ? " admin-live__frame--expanded" : ""}`}>
          <div className="admin-live__viewport">
            <ul className="admin-live__list">
              {visibleItems.map((item) => (
                <LiveFeedRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
          <div className="admin-live__overlay">
            <button
              type="button"
              className="admin-live__toggle"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
            >
              {expanded ? (
                "Show less"
              ) : (
                <>
                  <span className="admin-live__toggle-more" aria-hidden="true">
                    ↓
                  </span>
                  {hiddenCount} more activit{hiddenCount === 1 ? "y" : "ies"}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <ul className="admin-live__list">
          {displayItems.map((item) => (
            <LiveFeedRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
