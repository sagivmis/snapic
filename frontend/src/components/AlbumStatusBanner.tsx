import type { EventAlbumStatus } from "../types";
import { useTranslation } from "../i18n";
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
  const { tPath } = useTranslation("components.albumStatus");
  const phase = resolvePhase(status, uploadActive, indexing);

  if (phase === "empty" && !uploadActive) {
    return null;
  }

  let title = tPath("title");
  let detail = "";

  switch (phase) {
    case "uploading":
      title = tPath("uploading");
      detail = tPath("uploadingDetail");
      break;
    case "indexing":
      title = tPath("indexing");
      detail = tPath("photoCount", { count: status?.photo_count ?? 0 });
      break;
    case "pending":
      title = tPath("pending");
      detail =
        status && status.pending_count > 0
          ? tPath(
              status.pending_count === 1 ? "pendingDetail_one" : "pendingDetail_other",
              { count: status.pending_count },
            )
          : tPath("pendingWaiting");
      break;
    case "failed":
      title = tPath("failedTitle");
      detail = tPath(
        (status?.failed_count ?? 0) === 1 ? "failedDetail_one" : "failedDetail_other",
        { count: status?.failed_count ?? 0 },
      );
      break;
    case "ready":
      title = tPath("readyTitle");
      detail = tPath("readyDetail", { count: status?.photo_count ?? 0 });
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
            {tPath("retryFailed")}
          </button>
        )}
      </div>
      {(phase === "indexing" || indexing) && (
        <IndexFacesProgress progress={indexProgress} label={tPath("indexingLabel")} />
      )}
    </div>
  );
}
