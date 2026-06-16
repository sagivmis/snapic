import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { GalleryPhoto } from "../types";
import "../styles/AlbumGrid.scss";

interface AlbumGridProps {
  photos: GalleryPhoto[];
  onDelete: (photoId: string) => void;
  onBulkDelete?: (photoIds: string[]) => void | Promise<void>;
  onSectionChange?: (photoId: string, section: string) => void;
  sectionOptions?: string[];
  disabled?: boolean;
}

export interface AlbumGridHandle {
  selectAll: () => void;
}

interface PreviewPhoto {
  id: string;
  url: string;
  filename: string;
}

export const AlbumGrid = forwardRef<AlbumGridHandle, AlbumGridProps>(function AlbumGrid(
  {
    photos,
    onDelete,
    onBulkDelete,
    onSectionChange,
    sectionOptions = ["general", "ceremony", "reception", "portraits", "party"],
    disabled = false,
  },
  ref,
) {
  const [preview, setPreview] = useState<PreviewPhoto | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
    [photos],
  );

  const allSelected = sortedPhotos.length > 0 && selected.size === sortedPhotos.length;
  const someSelected = selected.size > 0;

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

  useEffect(() => {
    setSelected((current) => {
      const visible = new Set(sortedPhotos.map((photo) => photo.id));
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [sortedPhotos]);

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelected(photoId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }

  function enterSelectAll() {
    setSelectMode(true);
    setSelected(new Set(sortedPhotos.map((photo) => photo.id)));
  }

  useImperativeHandle(
    ref,
    () => ({
      selectAll: enterSelectAll,
    }),
    [sortedPhotos],
  );

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(sortedPhotos.map((photo) => photo.id)));
  }

  async function handleBulkDelete() {
    if (!onBulkDelete || selected.size === 0) {
      return;
    }
    const ids = [...selected];
    const confirmed = window.confirm(
      `Remove ${ids.length} photo${ids.length === 1 ? "" : "s"} from the album? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    await onBulkDelete(ids);
    exitSelectMode();
  }

  if (photos.length === 0) {
    return (
      <div className="album-grid album-grid--empty">
        <p>No photos yet. Upload your wedding album above.</p>
      </div>
    );
  }

  return (
    <>
      {onBulkDelete && (
        <div className="album-grid__toolbar">
          {!selectMode ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disabled || sortedPhotos.length === 0}
                onClick={enterSelectAll}
              >
                Select all ({sortedPhotos.length})
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disabled}
                onClick={() => setSelectMode(true)}
              >
                Select photos…
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" disabled={disabled} onClick={exitSelectMode}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disabled || sortedPhotos.length === 0}
                onClick={toggleSelectAll}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <button
                type="button"
                className="btn btn-secondary album-grid__delete-selected"
                disabled={disabled || !someSelected}
                onClick={() => void handleBulkDelete()}
              >
                Delete selected{someSelected ? ` (${selected.size})` : ""}
              </button>
            </>
          )}
        </div>
      )}

      {missingUrls && (
        <p className="album-grid__warn">
          Some previews could not be loaded. Refresh the page after the API redeploys.
        </p>
      )}

      <div className={`album-grid${selectMode ? " album-grid--selecting" : ""}`}>
        {sortedPhotos.map((photo) => {
          const url = urls[photo.id];
          const label = photo.filename ?? "Wedding photo";
          const isSelected = selected.has(photo.id);

          return (
            <figure
              key={photo.id}
              className={`album-grid__item${isSelected ? " album-grid__item--selected" : ""}`}
            >
              {selectMode && (
                <label className="album-grid__select">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggleSelected(photo.id)}
                  />
                  <span className="sr-only">Select {label}</span>
                </label>
              )}

              <button
                type="button"
                className="album-grid__thumb"
                disabled={!url || (selectMode && disabled)}
                onClick={() => {
                  if (selectMode) {
                    toggleSelected(photo.id);
                    return;
                  }
                  if (url) {
                    setPreview({ id: photo.id, url, filename: label });
                  }
                }}
                aria-label={selectMode ? `Select ${label}` : `View ${label}`}
                aria-pressed={selectMode ? isSelected : undefined}
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
                {onSectionChange && !selectMode && (
                  <select
                    className="album-grid__section"
                    value={photo.section ?? "general"}
                    disabled={disabled}
                    onChange={(event) => onSectionChange(photo.id, event.target.value)}
                    aria-label={`Section for ${label}`}
                  >
                    {sectionOptions.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                )}
                {!selectMode && (
                  <button
                    type="button"
                    className="album-grid__remove btn btn-ghost"
                    disabled={disabled}
                    onClick={() => onDelete(photo.id)}
                  >
                    Remove
                  </button>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>

      {preview && !selectMode && (
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
});
