import { useEffect } from "react";
import { getImageDataUrl } from "../utils/downloadZip";
import { formatMatchedPerson, formatPersonScores } from "../utils/matchedPerson";
import type { MatchedPhoto } from "../types";
import "../styles/Lightbox.scss";

interface LightboxProps {
  photo: MatchedPhoto | null;
  onClose: () => void;
}

export function Lightbox({ photo, onClose }: LightboxProps) {
  useEffect(() => {
    if (!photo) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [photo, onClose]);

  if (!photo) {
    return null;
  }

  const title = photo.filename ?? photo.url ?? "Wedding photo";
  const matchedLabel = formatMatchedPerson(photo.matched_person);
  const personScores = formatPersonScores(photo);

  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <div
        className="lightbox__dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button type="button" onClick={onClose} className="lightbox__close">
          Close ✕
        </button>

        <img src={getImageDataUrl(photo)} alt={title} className="lightbox__image" />

        <div className="lightbox__caption">
          <p className="lightbox__title">{title}</p>
          <div className="lightbox__meta">
            {matchedLabel && <span>{matchedLabel}</span>}
            {personScores && <span>{personScores}</span>}
            {!personScores && <span>{(photo.score * 100).toFixed(0)}% match</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
