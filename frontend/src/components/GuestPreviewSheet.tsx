import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../i18n";
import "../styles/GuestPreviewSheet.scss";

interface GuestPreviewSheetProps {
  open: boolean;
  slug: string;
  onClose: () => void;
}

/**
 * Half-sheet (mobile) / modal (desktop) that renders the live guest page in an
 * iframe so the couple/photographer can see exactly what guests will experience
 * without leaving their current screen.
 */
export function GuestPreviewSheet({ open, slug, onClose }: GuestPreviewSheetProps) {
  const { tPath } = useTranslation("events.setup.preview");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setLoaded(false);
    }
  }, [open]);

  if (!open || !slug) {
    return null;
  }

  const previewUrl = `/e/${slug}/preview`;

  return createPortal(
    <div
      className="guest-preview-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={tPath("title")}
    >
      <button
        type="button"
        className="guest-preview-sheet__backdrop"
        aria-label={tPath("close")}
        onClick={onClose}
      />
      <div className="guest-preview-sheet__panel">
        <header className="guest-preview-sheet__head">
          <div>
            <h2>{tPath("title")}</h2>
            <p>{tPath("subtitle")}</p>
          </div>
          <div className="guest-preview-sheet__head-actions">
            <a
              className="guest-preview-sheet__open"
              href={`/e/${slug}/preview`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tPath("openInTab")} ↗
            </a>
            <button
              type="button"
              className="guest-preview-sheet__close"
              onClick={onClose}
              aria-label={tPath("close")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="guest-preview-sheet__frame-wrap">
          {!loaded && (
            <div className="guest-preview-sheet__loading">
              <span className="spinner spinner-lg" />
              <p>{tPath("loading")}</p>
            </div>
          )}
          <iframe
            className="guest-preview-sheet__frame"
            src={previewUrl}
            title={tPath("title")}
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
