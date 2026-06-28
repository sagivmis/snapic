import { useEffect, type ReactNode } from "react";
import { useTranslation } from "../i18n";
import "../styles/HelpDrawer.scss";

export interface HelpTopic {
  id: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  topics: HelpTopic[];
  footer?: ReactNode;
}

export function HelpDrawer({
  open,
  onClose,
  title,
  subtitle,
  topics,
  footer,
}: HelpDrawerProps) {
  const { tPath } = useTranslation("events.setup.help");

  useEffect(() => {
    if (!open) return;
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

  if (!open) {
    return null;
  }

  return (
    <div className="help-drawer" role="dialog" aria-modal="true" aria-label={title ?? tPath("title")}>
      <button
        type="button"
        className="help-drawer__backdrop"
        aria-label={tPath("close")}
        onClick={onClose}
      />
      <aside className="help-drawer__panel">
        <header className="help-drawer__head">
          <div>
            <h2>{title ?? tPath("title")}</h2>
            {(subtitle ?? tPath("subtitle")) && (
              <p>{subtitle ?? tPath("subtitle")}</p>
            )}
          </div>
          <button
            type="button"
            className="help-drawer__close"
            onClick={onClose}
            aria-label={tPath("close")}
          >
            ×
          </button>
        </header>

        <ul className="help-drawer__topics">
          {topics.map((topic) => (
            <li key={topic.id} className="help-drawer__topic">
              <h3>{topic.title}</h3>
              <p>{topic.body}</p>
              {topic.actionLabel && topic.onAction && (
                <button
                  type="button"
                  className="help-drawer__topic-action"
                  onClick={() => {
                    topic.onAction?.();
                    onClose();
                  }}
                >
                  {topic.actionLabel} →
                </button>
              )}
            </li>
          ))}
        </ul>

        {footer && <div className="help-drawer__footer">{footer}</div>}
      </aside>
    </div>
  );
}
