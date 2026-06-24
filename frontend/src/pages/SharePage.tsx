import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { fetchSharedResults } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { ResultsGrid } from "../components/ResultsGrid";
import { useTranslation } from "../i18n";
import type { MatchResponse } from "../types";
import "../styles/EventGuest.scss";

export function SharePage() {
  const { t, tPath } = useTranslation("events.share");
  const { shareId: paramShareId } = useParams();
  const [searchParams] = useSearchParams();
  const shareId = paramShareId ?? searchParams.get("share");
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(shareId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSharedResults(shareId)
      .then((shared) => {
        setResult(shared);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : tPath("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [shareId, tPath]);

  if (!shareId) {
    return (
      <div className="event-guest">
        <p className="error-banner">{tPath("invalidLink")}</p>
        <Link to="/">{t("backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="event-guest">
      <InstallPrompt />
      <div className="event-guest__language">
        <LanguageSwitcher />
      </div>
      <header className="event-guest__header">
        <p className="event-guest__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="event-guest__desc">{tPath("desc")}</p>
      </header>

      <div className="event-guest__content">
        <ResultsGrid
          result={result}
          loading={loading}
          onStartSearch={() => undefined}
          canMatch={false}
          readOnly
          guestMode
          eventId={result?.event_id}
        />
        {error && <p className="error-banner">{error}</p>}
      </div>
    </div>
  );
}
