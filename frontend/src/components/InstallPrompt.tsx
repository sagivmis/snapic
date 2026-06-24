import { useEffect, useState } from "react";
import { useTranslation } from "../i18n";
import "../styles/InstallPrompt.scss";

const DISMISS_KEY = "snapic-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isMobile(): boolean {
  return (
    isIos() ||
    /Android/i.test(window.navigator.userAgent) ||
    window.matchMedia("(max-width: 768px)").matches
  );
}

export function InstallPrompt() {
  const { tPath } = useTranslation("components.installPrompt");
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const ios = isIos();
  const canNativeInstall = installEvent != null;

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    if (!isMobile()) {
      return;
    }

    setVisible(true);

    function onBeforeInstall(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setInstallEvent(event);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowGuide(false);
  }

  async function handleAddToHomeScreen() {
    if (canNativeInstall && installEvent) {
      setInstalling(true);
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
        }
      } finally {
        setInstalling(false);
        setInstallEvent(null);
      }
      return;
    }

    setShowGuide(true);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="install-prompt" role="region" aria-label={tPath("aria")}>
      <div className="install-prompt__content">
        <p className="install-prompt__title">{tPath("title")}</p>
        <p className="install-prompt__desc">{tPath("desc")}</p>

        {showGuide && (
          <ol className="install-prompt__steps">
            {ios ? (
              <>
                <li>{tPath("iosStep1")}</li>
                <li>{tPath("iosStep2")}</li>
                <li>{tPath("iosStep3")}</li>
              </>
            ) : (
              <>
                <li>{tPath("androidStep1")}</li>
                <li>{tPath("androidStep2")}</li>
                <li>{tPath("androidStep3")}</li>
              </>
            )}
          </ol>
        )}

        <div className="install-prompt__actions">
          <button
            type="button"
            className="btn-primary install-prompt__install"
            onClick={handleAddToHomeScreen}
            disabled={installing}
          >
            {installing ? tPath("adding") : tPath("addBtn")}
          </button>
          <button type="button" className="btn-ghost install-prompt__dismiss" onClick={dismiss}>
            {tPath("notNow")}
          </button>
        </div>

        {!canNativeInstall && !showGuide && ios && (
          <p className="install-prompt__note">{tPath("iosNote")}</p>
        )}
      </div>
    </div>
  );
}
