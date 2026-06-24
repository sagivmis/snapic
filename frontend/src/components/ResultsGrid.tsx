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
import { useTranslation } from "../i18n";
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

const COUPLE_FILTER_IDS: CoupleFilter[] = ["all", "1", "2", "both"];

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
  const { tPath } = useTranslation("components.resultsGrid");
  const { getAccessToken, anonymousSessionId: sessionId } = useAuth();
  const [lightboxPhoto, setLightboxPhoto] = useState<MatchedPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingTogether, setDownloadingTogether] = useState(false);
  const [coupleFilter, setCoupleFilter] = useState<CoupleFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [skippedOpen, setSkippedOpen] = useState(false);

  const coupleFilters = useMemo(
    () =>
      COUPLE_FILTER_IDS.map((id) => ({
        id,
        label: tPath(`filters.${id === "1" ? "person1" : id === "2" ? "person2" : id}`),
      })),
    [tPath],
  );

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
    const foundPart =
      result?.matched.length && matchProgress
        ? tPath("foundSoFar", { count: result.matched.length })
        : "";
    return (
      <div className="results results--loading">
        <span className="spinner spinner-lg" />
        <p className="results__loading-title">
          {guestMode ? tPath("searchingGuest") : tPath("searchingDemo")}
        </p>
        <p className="results__loading-desc">
          {matchProgress && matchProgress.total > 0
            ? tPath("progressScanned", {
                processed: matchProgress.processed,
                total: matchProgress.total,
                foundPart,
              })
            : guestMode
              ? tPath("progressHintGuest")
              : tPath("progressHintDemo")}
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
          <p className="results__empty-title">{tPath("emptyTitle")}</p>
          <p className="results__empty-desc">{tPath("emptyDesc")}</p>
          {canMatch && !readOnly && (
            <button type="button" onClick={onStartSearch} className="btn-primary results__empty-cta">
              {tPath("findNow")}
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
              {tPath("progressLabel", {
                found: result.matched.length,
                processed: matchProgress.processed,
                total: matchProgress.total,
              })}
            </p>
          </div>
        )}
        <div className="card-wedding results__summary">
          <p className="results__summary-title">
            {result.matched.length === 0
              ? tPath("noMatchesYet")
              : tPath(result.matched.length === 1 ? "photosFound_one" : "photosFound_other", {
                  count: result.matched.length,
                })}
          </p>
          <p className="results__summary-desc">
            {tPath(result.total_gallery === 1 ? "searchedGallery_one" : "searchedGallery_other", {
              count: result.total_gallery,
            })}
            {result.couple_mode ? ` · ${tPath("coupleMode")}` : ""}
            {togetherCount > 0 && result.couple_mode
              ? tPath("togetherCount", { count: togetherCount })
              : ""}
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
                  ? tPath("preparingDownload")
                  : guestMode
                    ? tPath("downloadGuest")
                    : tPath("downloadZip")}
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
                  {downloadingTogether
                    ? tPath("preparing")
                    : tPath("togetherPhotos", { count: togetherCount })}
                </button>
              )}
              {result.share_id && !readOnly && (
                <button type="button" onClick={handleCopyShareLink} className="btn-ghost bordered">
                  {copied ? tPath("linkCopied") : tPath("copyShareLink")}
                </button>
              )}
            </div>
          )}
        </div>

        {result.couple_mode && result.matched.length > 0 && (
          <div className="results__toolbar">
            <div className="results__filters" role="tablist" aria-label={tPath("filterAria")}>
              {coupleFilters.map((filter) => (
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
              <span className="results__sort-label">{tPath("sortLabel")}</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="results__sort-select"
              >
                <option value="score">{tPath("sortScore")}</option>
                <option value="together-first">{tPath("sortTogether")}</option>
              </select>
            </label>
          </div>
        )}

        {result.matched.length === 0 ? (
          <p className="results__no-matches">
            {guestMode ? tPath("noMatchesGuest") : tPath("noMatchesDemo")}
          </p>
        ) : visibleMatches.length === 0 ? (
          <p className="results__no-matches">
            {guestMode ? tPath("noFilterGuest") : tPath("noFilterDemo")}
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
                    alt={item.filename ?? item.url ?? tPath("matchedPhotoAlt")}
                    className="result-card__image"
                  />
                  <span className="result-card__badge result-card__badge--score">
                    {tPath("matchBadge", { percent: (item.score * 100).toFixed(0) })}
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
                    {item.filename ?? item.url ?? tPath("weddingPhoto")}
                  </p>
                  {formatPersonScores(item) && (
                    <p className="result-card__scores">{formatPersonScores(item)}</p>
                  )}
                  <p className="result-card__hint">{tPath("tapToView")}</p>
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
                {tPath(result.skipped.length === 1 ? "skipped_one" : "skipped_other", {
                  count: result.skipped.length,
                })}
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
