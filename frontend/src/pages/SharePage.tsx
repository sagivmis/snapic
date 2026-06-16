import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchSharedResults } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { ResultsGrid } from "../components/ResultsGrid";
import type { MatchResponse } from "../types";
import "../styles/EventGuest.scss";

export function SharePage() {
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
        setError(err instanceof Error ? err.message : "Could not load shared results");
      })
      .finally(() => setLoading(false));
  }, [shareId]);

  if (!shareId) {
    return (
      <div className="event-guest">
        <p className="error-banner">Invalid share link</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="event-guest">
      <InstallPrompt />
      <header className="event-guest__header">
        <p className="event-guest__eyebrow">Shared gallery</p>
        <h1>Wedding moments</h1>
        <p className="event-guest__desc">Photos shared from a Snapic search</p>
      </header>

      <div className="event-guest__content">
        <ResultsGrid
          result={result}
          loading={loading}
          onStartSearch={() => undefined}
          canMatch={false}
          readOnly
          guestMode
        />
        {error && <p className="error-banner">{error}</p>}
      </div>
    </div>
  );
}
