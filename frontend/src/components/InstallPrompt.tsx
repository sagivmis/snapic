import { useEffect, useState } from "react";
import "../styles/InstallPrompt.scss";

const DISMISS_KEY = "snapic-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    function onBeforeInstall(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleInstall() {
    if (!installEvent) {
      return;
    }
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="install-prompt" role="region" aria-label="Install Snapic">
      <div className="install-prompt__content">
        <p className="install-prompt__title">Install Snapic</p>
        {iosHint ? (
          <p className="install-prompt__desc">
            Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong> for quick
            access like an app.
          </p>
        ) : (
          <p className="install-prompt__desc">
            Add Snapic to your home screen for a full-screen app experience at the wedding.
          </p>
        )}
        <div className="install-prompt__actions">
          {!iosHint && (
            <button type="button" className="btn-primary install-prompt__install" onClick={handleInstall}>
              Install app
            </button>
          )}
          <button type="button" className="btn-ghost install-prompt__dismiss" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
