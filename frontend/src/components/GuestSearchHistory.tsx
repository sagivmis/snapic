import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../i18n";
import type { MatchRunSummary } from "../types";
import "../styles/GuestSearchHistory.scss";

const PAST_SEARCHES_PREVIEW = 4;

function formatRunParts(
  value: string | null | undefined,
  recentLabel: string,
  searchLabel: string,
): { date: string; time: string } {
  if (!value) {
    return { date: recentLabel, time: searchLabel };
  }
  const parsed = new Date(value);
  return {
    date: parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

interface GuestSearchHistoryProps {
  runs: MatchRunSummary[];
}

export function GuestSearchHistory({ runs }: GuestSearchHistoryProps) {
  const { tPath } = useTranslation("components.guestHistory");
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRuns = showAll ? runs : runs.slice(0, PAST_SEARCHES_PREVIEW);

  useEffect(() => {
    if (!open) {
      setShowAll(false);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function formatMatchCount(count: number): string {
    if (count === 0) {
      return tPath("noMatches");
    }
    const key = count === 1 ? "photo_one" : "photo_other";
    return tPath(key, { count });
  }

  if (runs.length === 0) {
    return null;
  }

  return (
    <div className="guest-history" ref={rootRef}>
      <button
        type="button"
        className={`guest-history__trigger${open ? " guest-history__trigger--open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={tPath("triggerAria", { count: runs.length })}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="guest-history__trigger-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8v4l3 2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 0 0-17 0Z"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path
            d="M12 3.5V2M18.4 5.6l1.1-1.1M20.5 12H22M18.4 18.4l1.1 1.1M12 20.5V22M5.6 18.4l-1.1 1.1M3.5 12H2M5.6 5.6 4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="guest-history__trigger-badge">{runs.length}</span>
      </button>

      {open && (
        <div className="guest-history__panel" role="dialog" aria-label={tPath("dialogAria")}>
          <div className="guest-history__panel-header">
            <h2>{tPath("title")}</h2>
            <button
              type="button"
              className="guest-history__close"
              aria-label={tPath("closeAria")}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <ul
            className={`guest-history__list${showAll ? " guest-history__list--expanded" : ""}`}
          >
            {visibleRuns.map((run) => {
              const { date, time } = formatRunParts(
                run.created_at,
                tPath("recent"),
                tPath("search"),
              );
              const countLabel = formatMatchCount(run.matched_count);
              const row = (
                <>
                  <span className="guest-history__item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M12 7.5v4.75l2.75 1.75"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="guest-history__item-meta">
                    <span className="guest-history__item-date">{date}</span>
                    <span className="guest-history__item-time">{time}</span>
                  </span>
                  <span
                    className={`guest-history__item-badge${
                      run.matched_count === 0 ? " guest-history__item-badge--empty" : ""
                    }`}
                  >
                    {countLabel}
                  </span>
                  {run.share_id && (
                    <span className="guest-history__item-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 6l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </>
              );

              return (
                <li key={run.id} className="guest-history__item">
                  {run.share_id ? (
                    <Link
                      to={`/share/${run.share_id}`}
                      className="guest-history__item-link"
                      onClick={() => setOpen(false)}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="guest-history__item-link guest-history__item-link--static">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {runs.length > PAST_SEARCHES_PREVIEW && (
            <button
              type="button"
              className="guest-history__toggle btn btn-ghost"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? tPath("showFewer")
                : tPath("showAll", { count: runs.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
