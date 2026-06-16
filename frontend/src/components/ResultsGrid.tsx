import { useMemo, useState } from "react";
import {
  type CoupleFilter,
  filterCoupleMatches,
  formatMatchedPerson,
  formatPersonScores,
  sortMatches,
  type SortMode,
} from "../utils/matchedPerson";
import { buildShareUrl } from "../api/client";
import type { AuthFetchOptions } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { downloadMatchesAsZip } from "../utils/downloadZip";
import { Lightbox } from "./Lightbox";
import type { MatchedPhoto, MatchResponse, SkippedPhoto } from "../types";
import "../styles/ResultsGrid.scss";

interface ResultsGridProps {
  result: MatchResponse | null;
  loading: boolean;
  onStartSearch: () => void;
  canMatch: boolean;
  readOnly?: boolean;
  guestMode?: boolean;
  eventId?: string | null;
  auth?: AuthFetchOptions;
  matchProgress?: { processed: number; total: number } | null;
}

const COUPLE_FILTERS: { id: CoupleFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "1", label: "Person 1" },
  { id: "2", label: "Person 2" },
  { id: "both", label: "Both" },
];

function formatReason(reason: string): string {
  return reason.replace(/_/g, " ");
}

function summarizeSkipped(skipped: SkippedPhoto[]): string {
  const counts = skipped.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([reason, count]) => `${count} ${formatReason(reason)}`)
    .join(", ");
}

export function ResultsGrid({
  result,
  loading,
  onStartSearch,
  canMatch,
  readOnly = false,
  guestMode = false,
  eventId = null,
  auth,
  matchProgress = null,
}: ResultsGridProps) {
  const { getAccessToken, anonymousSessionId: sessionId } = useAuth();
  const [lightboxPhoto, setLightboxPhoto] = useState<MatchedPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingTogether, setDownloadingTogether] = useState(false);
  const [coupleFilter, setCoupleFilter] = useState<CoupleFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [skippedOpen, setSkippedOpen] = useState(false);

  const togetherCount = useMemo(
    () => result?.matched.filter((item) => item.matched_person === "both").length ?? 0,
    [result],
  );

  const visibleMatches = useMemo(() => {
    if (!result) {
      return [];
    }
    const filtered = result.couple_mode
      ? filterCoupleMatches(result.matched, coupleFilter)
      : result.matched;
    return sortMatches(filtered, sortMode);
  }, [result, coupleFilter, sortMode]);

  async function handleCopyShareLink() {
    if (!result?.share_id) {
      return;
    }
    const link = buildShareUrl(result.share_id);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadZip(items: MatchedPhoto[], archiveName: string) {
    if (!items.length) {
      return;
    }
    const token = auth?.token ?? (await getAccessToken());
    await downloadMatchesAsZip(items, archiveName, {
      eventId,
      auth: {
        token,
        anonymousSessionId: auth?.anonymousSessionId ?? sessionId,
      },
    });
  }

  if (loading && !result?.matched.length) {
    return (
      <div className="results results--loading">
        <span className="spinner spinner-lg" />
        <p className="results__loading-title">
          {guestMode ? "Searching the wedding album…" : "Searching your gallery..."}
        </p>
        <p className="results__loading-desc">
          {matchProgress && matchProgress.total > 0
            ? `Scanned ${matchProgress.processed} of ${matchProgress.total} photos${
                result?.matched.length ? ` · ${result.matched.length} found so far` : ""
              }`
            : guestMode
              ? "This can take a moment for large albums — matches appear as we find them"
              : "Looking for your face in every photo"}
        </p>
        {matchProgress && matchProgress.total > 0 && (
          <div className="results__progress results__progress--loading" role="status">
            <div
              className="results__progress-bar"
              style={{
                width: `${Math.round((matchProgress.processed / matchProgress.total) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results results--empty">
        <div className="card-wedding">
          <p className="results__empty-title">Your moments await</p>
          <p className="results__empty-desc">
            Once you&apos;ve added your portrait and gallery photos, tap{" "}
            <span className="text-champagne">Find my photos</span> in the sidebar to discover every
            picture you appear in.
          </p>
          {canMatch && !readOnly && (
            <button type="button" onClick={onStartSearch} className="btn-primary results__empty-cta">
              Find my photos now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="results">
        {loading && matchProgress && matchProgress.total > 0 && (
          <div className="results__progress" role="status">
            <div
              className="results__progress-bar"
              style={{ width: `${Math.round((matchProgress.processed / matchProgress.total) * 100)}%` }}
            />
            <p className="results__progress-label">
              Found {result.matched.length} so far · {matchProgress.processed}/{matchProgress.total} scanned
            </p>
          </div>
        )}
        <div className="card-wedding results__summary">
          <p className="results__summary-title">
            {result.matched.length === 0
              ? "No matches yet"
              : `${result.matched.length} photo${result.matched.length === 1 ? "" : "s"} found`}
          </p>
          <p className="results__summary-desc">
            Searched {result.total_gallery} gallery photo{result.total_gallery === 1 ? "" : "s"}
            {result.couple_mode ? " · couple mode" : ""}
            {togetherCount > 0 && result.couple_mode ? ` · ${togetherCount} together` : ""}
          </p>

          {result.matched.length > 0 && (
            <div className={`results__actions${guestMode ? " results__actions--guest" : ""}`}>
              <button
                type="button"
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await handleDownloadZip(
                      result.matched,
                      guestMode ? "my-wedding-photos" : "snapic-wedding-photos",
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                disabled={downloading || loading}
                className={guestMode ? "btn-primary results__download-guest" : "btn-primary"}
              >
                {downloading
                  ? "Preparing download…"
                  : guestMode
                    ? "Download my photos"
                    : "Download all as ZIP"}
              </button>
              {togetherCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    setDownloadingTogether(true);
                    try {
                      const together = result.matched.filter(
                        (item) => item.matched_person === "both",
                      );
                      await handleDownloadZip(together, "snapic-together-photos");
                    } finally {
                      setDownloadingTogether(false);
                    }
                  }}
                  disabled={downloadingTogether}
                  className="btn-ghost bordered"
                >
                  {downloadingTogether ? "Preparing..." : `Together photos (${togetherCount})`}
                </button>
              )}
              {result.share_id && !readOnly && (
                <button type="button" onClick={handleCopyShareLink} className="btn-ghost bordered">
                  {copied ? "Link copied!" : "Copy share link for guests"}
                </button>
              )}
            </div>
          )}
        </div>

        {result.couple_mode && result.matched.length > 0 && (
          <div className="results__toolbar">
            <div className="results__filters" role="tablist" aria-label="Filter by person">
              {COUPLE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={coupleFilter === filter.id}
                  className={`results__filter-chip${
                    coupleFilter === filter.id ? " results__filter-chip--active" : ""
                  }${filter.id === "both" ? " results__filter-chip--both" : ""}`}
                  onClick={() => setCoupleFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="results__sort">
              <span className="results__sort-label">Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="results__sort-select"
              >
                <option value="score">Best match first</option>
                <option value="together-first">Together photos first</option>
              </select>
            </label>
          </div>
        )}

        {result.matched.length === 0 ? (
          <p className="results__no-matches">
            {guestMode
              ? "We couldn't find you in the album yet. Try a clearer, well-lit selfie facing the camera."
              : "We couldn't find matching photos. Try adjusting sensitivity in the sidebar, or add clearer gallery images."}
          </p>
        ) : visibleMatches.length === 0 ? (
          <p className="results__no-matches">
            {guestMode
              ? "No photos match this filter. Try another tab above."
              : "No photos match this filter. Try another tab or lower the sensitivity."}
          </p>
        ) : (
          <div className="results__grid">
            {visibleMatches.map((item) => (
              <article
                key={`${item.source}-${item.index}-${item.score}`}
                className="result-card"
                onClick={() => setLightboxPhoto(item)}
              >
                <div className="result-card__image-wrap">
                  <img
                    src={`data:image/jpeg;base64,${item.preview_base64}`}
                    alt={item.filename ?? item.url ?? "Matched photo"}
                    className="result-card__image"
                  />
                  <span className="result-card__badge result-card__badge--score">
                    {(item.score * 100).toFixed(0)}% match
                  </span>
                  {item.matched_person != null && (
                    <span
                      className={`result-card__badge result-card__badge--person${
                        item.matched_person === "both" ? " result-card__badge--both" : ""
                      }`}
                    >
                      {formatMatchedPerson(item.matched_person)}
                    </span>
                  )}
                </div>
                <div className="result-card__meta">
                  <p className="result-card__title">
                    {item.filename ?? item.url ?? "Wedding photo"}
                  </p>
                  {formatPersonScores(item) && (
                    <p className="result-card__scores">{formatPersonScores(item)}</p>
                  )}
                  <p className="result-card__hint">Tap to view full size</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {result.skipped.length > 0 && (
          <details
            className="results__skipped"
            open={skippedOpen}
            onToggle={(event) => setSkippedOpen(event.currentTarget.open)}
          >
            <summary className="results__skipped-summary">
              <span>
                {result.skipped.length} photo{result.skipped.length === 1 ? "" : "s"} skipped
              </span>
              <span className="results__skipped-breakdown">{summarizeSkipped(result.skipped)}</span>
            </summary>
            <ul className="results__skipped-list">
              {result.skipped.map((item) => (
                <li key={`${item.source}-${item.index}-${item.reason}`}>
                  <span className="results__skipped-name">
                    {item.filename ?? item.url ?? `${item.source} #${item.index + 1}`}
                  </span>
                  <span> — {formatReason(item.reason)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Lightbox
        photo={lightboxPhoto}
        eventId={eventId}
        auth={auth}
        onClose={() => setLightboxPhoto(null)}
      />
    </>
  );
}
