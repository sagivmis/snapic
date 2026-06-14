import { useEffect, useMemo, useState } from "react";
import type { GalleryPhoto } from "../types";
import "../styles/AlbumGrid.scss";

interface AlbumGridProps {
  photos: GalleryPhoto[];
  onDelete: (photoId: string) => void;
  disabled?: boolean;
}

interface PreviewPhoto {
  id: string;
  url: string;
  filename: string;
}

export function AlbumGrid({ photos, onDelete, disabled = false }: AlbumGridProps) {
  const [preview, setPreview] = useState<PreviewPhoto | null>(null);

  const urls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const photo of photos) {
      if (photo.signed_url) {
        map[photo.id] = photo.signed_url;
      }
    }
    return map;
  }, [photos]);

  const missingUrls = photos.length > 0 && photos.some((photo) => !urls[photo.id]);

  useEffect(() => {
    if (!preview) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreview(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preview]);

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    [photos],
  );

  if (photos.length === 0) {
    return (
      <div className="album-grid album-grid--empty">
        <p>No photos yet. Upload your wedding album above.</p>
      </div>
    );
  }

  return (
    <>
      {missingUrls && (
        <p className="album-grid__warn">
          Some previews could not be loaded. Refresh the page after the API redeploys.
        </p>
      )}

      <div className="album-grid">
        {sortedPhotos.map((photo) => {
          const url = urls[photo.id];
          const label = photo.filename ?? "Wedding photo";

          return (
            <figure key={photo.id} className="album-grid__item">
              <button
                type="button"
                className="album-grid__thumb"
                disabled={!url}
                onClick={() => url && setPreview({ id: photo.id, url, filename: label })}
                aria-label={`View ${label}`}
              >
                {url ? (
                  <img src={url} alt={label} loading="lazy" />
                ) : (
                  <span className="album-grid__placeholder">…</span>
                )}
              </button>
              <figcaption className="album-grid__caption">
                <span className="album-grid__name" title={label}>
                  {label}
                </span>
                <button
                  type="button"
                  className="album-grid__remove btn btn-ghost"
                  disabled={disabled}
                  onClick={() => onDelete(photo.id)}
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {preview && (
        <div className="album-grid__lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className="album-grid__lightbox-inner" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="album-grid__lightbox-close btn btn-ghost" onClick={() => setPreview(null)}>
              Close
            </button>
            <img src={preview.url} alt={preview.filename} />
            <p>{preview.filename}</p>
          </div>
        </div>
      )}
    </>
  );
}
