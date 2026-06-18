import type { EventAlbumStatus } from "../types";
import { IndexFacesProgress } from "./IndexFacesProgress";
import type { IndexStreamEvent } from "../api/client";
import "../styles/AlbumStatusBanner.scss";

interface AlbumStatusBannerProps {
  status: EventAlbumStatus | null;
  uploadActive: boolean;
  indexing: boolean;
  indexProgress: Extract<IndexStreamEvent, { type: "progress" }> | null;
  onRetryFailed?: () => void;
  retryDisabled?: boolean;
}

function resolvePhase(
  status: EventAlbumStatus | null,
  uploadActive: boolean,
  indexing: boolean,
): "empty" | "uploading" | "indexing" | "failed" | "ready" | "pending" {
  if (!status || status.photo_count === 0) {
    return uploadActive ? "uploading" : "empty";
  }
  if (uploadActive) {
    return "uploading";
  }
  if (indexing || status.indexing_in_progress) {
    return "indexing";
  }
  if (status.pending_count > 0) {
    return "pending";
  }
  if (status.failed_count > 0) {
    return "failed";
  }
  if (status.gallery_search_ready) {
    return "ready";
  }
  return "pending";
}

export function AlbumStatusBanner({
  status,
  uploadActive,
  indexing,
  indexProgress,
  onRetryFailed,
  retryDisabled = false,
}: AlbumStatusBannerProps) {
  const phase = resolvePhase(status, uploadActive, indexing);

  if (phase === "empty" && !uploadActive) {
    return null;
  }

  let title = "Album status";
  let detail = "";

  switch (phase) {
    case "uploading":
      title = "Uploading photos…";
      detail = "Face indexing will start automatically when uploads finish.";
      break;
    case "indexing":
      title = "Indexing faces for guest search…";
      detail = `${status?.photo_count ?? 0} photos in album`;
      break;
    case "pending":
      title = "Preparing photos for search";
      detail =
        status && status.pending_count > 0
          ? `${status.pending_count} photo${status.pending_count === 1 ? "" : "s"} still processing`
          : "Waiting for indexing to finish";
      break;
    case "failed":
      title = "Ready for guests — with warnings";
      detail = `${status?.failed_count ?? 0} photo${status?.failed_count === 1 ? "" : "s"} failed indexing and won't appear in search`;
      break;
    case "ready":
      title = "Ready for guest search";
      detail = `${status?.photo_count ?? 0} photos indexed — guests can find themselves now`;
      break;
    default:
      break;
  }

  const tone =
    phase === "ready"
      ? "ready"
      : phase === "failed"
        ? "warn"
        : phase === "uploading" || phase === "indexing" || phase === "pending"
          ? "progress"
          : "neutral";

  return (
    <div className={`album-status album-status--${tone}`} role="status" aria-live="polite">
      <div className="album-status__header">
        <div>
          <strong className="album-status__title">{title}</strong>
          {detail && <p className="album-status__detail">{detail}</p>}
        </div>
        {phase === "failed" && onRetryFailed && (
          <button
            type="button"
            className="btn btn-secondary album-status__action"
            disabled={retryDisabled}
            onClick={onRetryFailed}
          >
            Retry failed
          </button>
        )}
      </div>
      {(phase === "indexing" || indexing) && (
        <IndexFacesProgress progress={indexProgress} label="Indexing faces…" />
      )}
    </div>
  );
}
