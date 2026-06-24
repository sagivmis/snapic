import { useEffect, useState } from "react";
import { fetchEventGalleryPhotoImage } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import { getImageDataUrl } from "../utils/downloadZip";
import { formatMatchedPerson, formatPersonScores } from "../utils/matchedPerson";
import type { MatchedPhoto } from "../types";
import type { AuthFetchOptions } from "../api/client";
import "../styles/Lightbox.scss";

interface LightboxProps {
  photo: MatchedPhoto | null;
  eventId?: string | null;
  auth?: AuthFetchOptions;
  onClose: () => void;
}

export function Lightbox({ photo, eventId, auth: authProp, onClose }: LightboxProps) {
  const { tPath } = useTranslation("components.lightbox");
  const { getAccessToken, anonymousSessionId } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  useEffect(() => {
    if (!photo) {
      setImageSrc(null);
      setLoadingFull(false);
      return;
    }

    let cancelled = false;

    if (photo.image_base64) {
      setImageSrc(getImageDataUrl(photo));
      setLoadingFull(false);
      return;
    }

    setImageSrc(`data:image/jpeg;base64,${photo.preview_base64}`);
    setLoadingFull(Boolean(eventId && photo.gallery_photo_id));

    if (eventId && photo.gallery_photo_id) {
      void (async () => {
        try {
          const token = authProp?.token ?? (await getAccessToken());
          const auth: AuthFetchOptions = {
            token,
            anonymousSessionId: authProp?.anonymousSessionId ?? anonymousSessionId,
          };
          const meta = await fetchEventGalleryPhotoImage(eventId, photo.gallery_photo_id!, auth);
          if (cancelled) {
            return;
          }
          setImageSrc(meta.signed_url);
        } catch {
          if (!cancelled) {
            setImageSrc(`data:image/jpeg;base64,${photo.preview_base64}`);
          }
        } finally {
          if (!cancelled) {
            setLoadingFull(false);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [photo, eventId, authProp, getAccessToken, anonymousSessionId]);

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

  const title = photo.filename ?? photo.url ?? tPath("weddingPhoto");
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
          {tPath("close")}
        </button>

        {imageSrc ? (
          <img src={imageSrc} alt={title} className="lightbox__image" />
        ) : (
          <div className="lightbox__loading">
            <span className="spinner spinner-lg" />
          </div>
        )}
        {loadingFull && imageSrc && (
          <p className="lightbox__loading-label">{tPath("loadingFull")}</p>
        )}

        <div className="lightbox__caption">
          <p className="lightbox__title">{title}</p>
          <div className="lightbox__meta">
            {matchedLabel && <span>{matchedLabel}</span>}
            {personScores && <span>{personScores}</span>}
            {!personScores && (
              <span>{tPath("matchPercent", { percent: (photo.score * 100).toFixed(0) })}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
