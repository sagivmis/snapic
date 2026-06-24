import type { IndexStreamEvent } from "../api/client";
import { useTranslation } from "../i18n";
import "../styles/IndexFacesProgress.scss";

interface IndexFacesProgressProps {
  progress: Extract<IndexStreamEvent, { type: "progress" }> | null;
  label?: string;
}

export function IndexFacesProgress({ progress, label }: IndexFacesProgressProps) {
  const { tPath } = useTranslation("components.indexFacesProgress");
  const displayLabel = label ?? tPath("label");

  if (!progress || progress.total === 0) {
    return null;
  }

  const percent = Math.round((progress.processed / progress.total) * 100);
  const indexedPart =
    progress.indexed > 0 ? tPath("indexedPart", { count: progress.indexed }) : "";
  const failedPart =
    progress.failed > 0 ? tPath("failedPart", { count: progress.failed }) : "";

  return (
    <div className="index-faces-progress" role="status" aria-live="polite">
      <div className="index-faces-progress__header">
        <span>{displayLabel}</span>
        <span>{percent}%</span>
      </div>
      <div className="index-faces-progress__track">
        <div className="index-faces-progress__bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="index-faces-progress__detail">
        {tPath("detail", {
          processed: progress.processed,
          total: progress.total,
          indexedPart,
          failedPart,
        })}
      </p>
    </div>
  );
}
