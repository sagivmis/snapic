import type { IndexStreamEvent } from "../api/client";
import "../styles/IndexFacesProgress.scss";

interface IndexFacesProgressProps {
  progress: Extract<IndexStreamEvent, { type: "progress" }> | null;
  label?: string;
}

export function IndexFacesProgress({ progress, label = "Indexing faces…" }: IndexFacesProgressProps) {
  if (!progress || progress.total === 0) {
    return null;
  }

  const percent = Math.round((progress.processed / progress.total) * 100);

  return (
    <div className="index-faces-progress" role="status" aria-live="polite">
      <div className="index-faces-progress__header">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="index-faces-progress__track">
        <div className="index-faces-progress__bar" style={{ width: `${percent}%` }} />
      </div>
      <p className="index-faces-progress__detail">
        {progress.processed} of {progress.total} photos
        {progress.indexed > 0 ? ` · ${progress.indexed} indexed` : ""}
        {progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
      </p>
    </div>
  );
}
