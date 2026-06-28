import { useEffect, useState } from "react";
import { GuestQrCode } from "./GuestQrCode";
import { useTranslation } from "../i18n";
import "../styles/ShareSheet.scss";

interface ShareSheetProps {
  open: boolean;
  url: string;
  eventTitle?: string;
  coupleNames?: string | null;
  onClose: () => void;
}

function hasNativeShare(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as Navigator & { share?: unknown }).share === "function";
}

export function ShareSheet({
  open,
  url,
  eventTitle,
  coupleNames,
  onClose,
}: ShareSheetProps) {
  const { tPath } = useTranslation("events.setup.share");
  const { tPath: tCoupleHome } = useTranslation("events.setup.coupleHome");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open || !url) {
    return null;
  }

  const shareText = tCoupleHome("shareText", { url });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function handleNative() {
    if (!hasNativeShare()) {
      await handleCopy();
      return;
    }
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title: eventTitle ?? coupleNames ?? "Snapic",
        text: shareText,
        url,
      });
    } catch {
      /* user cancelled */
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(
    tPath("emailSubject"),
  )}&body=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="share-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={tPath("title")}
    >
      <button
        type="button"
        className="share-sheet__backdrop"
        aria-label={tPath("close")}
        onClick={onClose}
      />
      <div className="share-sheet__panel">
        <div className="share-sheet__grip" aria-hidden="true" />
        <header className="share-sheet__head">
          <h2>{tPath("title")}</h2>
          <p>{tPath("subtitle")}</p>
        </header>

        <div className="share-sheet__qr">
          <GuestQrCode
            url={url}
            eventTitle={eventTitle}
            coupleNames={coupleNames}
          />
        </div>

        <label className="share-sheet__link-row">
          <span className="share-sheet__link-label">{tPath("linkLabel")}</span>
          <div className="share-sheet__link-input">
            <input type="text" value={url} readOnly onClick={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-secondary" onClick={() => void handleCopy()}>
              {copied ? tPath("copied") : tPath("copy")}
            </button>
          </div>
        </label>

        <div className="share-sheet__channels">
          {hasNativeShare() && (
            <button type="button" className="btn btn-primary share-sheet__native" onClick={() => void handleNative()}>
              {tPath("native")}
            </button>
          )}
          <a className="share-sheet__channel share-sheet__channel--whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true" className="share-sheet__channel-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.5A11 11 0 1 0 20.5 3.5zm-8.5 18a9 9 0 0 1-4.6-1.3l-.3-.2-2.9.9.9-2.8-.2-.3A9 9 0 1 1 12 21.5zm5-6.6c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.3 5.3 4.6 2.5 1 3.1.8 3.6.7.6-.1 1.6-.7 1.9-1.3.3-.6.3-1.2.2-1.3-.1-.1-.3-.2-.6-.3z"/>
              </svg>
            </span>
            <span>{tPath("whatsapp")}</span>
          </a>
          <a className="share-sheet__channel share-sheet__channel--email" href={emailHref}>
            <span aria-hidden="true" className="share-sheet__channel-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </span>
            <span>{tPath("email")}</span>
          </a>
        </div>

        <button type="button" className="btn btn-ghost share-sheet__done" onClick={onClose}>
          {tPath("close")}
        </button>
      </div>
    </div>
  );
}
