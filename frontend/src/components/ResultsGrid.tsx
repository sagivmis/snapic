import { useState } from "react";
import { formatMatchedPerson } from "../utils/matchedPerson";
import { buildShareUrl } from "../api/client";
import { downloadMatchesAsZip } from "../utils/downloadZip";
import { Lightbox } from "./Lightbox";
import type { MatchedPhoto, MatchResponse } from "../types";
import "../styles/ResultsGrid.scss";

interface ResultsGridProps {
  result: MatchResponse | null;
  loading: boolean;
  onStartSearch: () => void;
  canMatch: boolean;
  readOnly?: boolean;
}

function formatReason(reason: string): string {
  return reason.replace(/_/g, " ");
}

export function ResultsGrid({
  result,
  loading,
  onStartSearch,
  canMatch,
  readOnly = false,
}: ResultsGridProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<MatchedPhoto | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleCopyShareLink() {
    if (!result?.share_id) {
      return;
    }
    const link = buildShareUrl(result.share_id);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadZip() {
    if (!result?.matched.length) {
      return;
    }
    setDownloading(true);
    try {
      await downloadMatchesAsZip(result.matched);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="results results--loading">
        <span className="spinner spinner-lg" />
        <p className="results__loading-title">Searching your gallery...</p>
        <p className="results__loading-desc">Looking for your face in every photo</p>
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
        <div className="card-wedding results__summary">
          <p className="results__summary-title">
            {result.matched.length === 0
              ? "No matches yet"
              : `${result.matched.length} photo${result.matched.length === 1 ? "" : "s"} found`}
          </p>
          <p className="results__summary-desc">
            Searched {result.total_gallery} gallery photo{result.total_gallery === 1 ? "" : "s"}
            {result.couple_mode ? " · couple mode" : ""}
          </p>

          {result.matched.length > 0 && (
            <div className="results__actions">
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={downloading}
                className="btn-primary"
              >
                {downloading ? "Preparing ZIP..." : "Download all as ZIP"}
              </button>
              {result.share_id && !readOnly && (
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="btn-ghost bordered"
                >
                  {copied ? "Link copied!" : "Copy share link for guests"}
                </button>
              )}
            </div>
          )}
        </div>

        {result.matched.length === 0 ? (
          <p className="results__no-matches">
            We couldn&apos;t find matching photos. Try adjusting sensitivity in the sidebar, or add
            clearer gallery images.
          </p>
        ) : (
          <div className="results__grid">
            {result.matched.map((item) => (
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
                  <p className="result-card__hint">Tap to view full size</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {!readOnly && result.skipped.length > 0 && (
          <div className="results__skipped">
            <h3 className="results__skipped-title">
              {result.skipped.length} photo{result.skipped.length === 1 ? "" : "s"} skipped
            </h3>
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
          </div>
        )}
      </div>

      <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </>
  );
}
