import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchEventBySlug, fetchMyEventRuns, matchEventPhotosStream } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { ResultsGrid } from "../components/ResultsGrid";
import { SelfieUpload } from "../components/SelfieUpload";
import type { EventPublic, MatchResponse, MatchRunSummary } from "../types";
import "../styles/EventGuest.scss";

type GuestStep = "portrait" | "results";

function formatRunDate(value?: string | null): string {
  if (!value) {
    return "Recent search";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventGuestPage() {
  const { slug = "" } = useParams();
  const { session, getAccessToken, anonymousSessionId, signInWithGoogle } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [step, setStep] = useState<GuestStep>("portrait");
  const [coupleMode, setCoupleMode] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [partnerSelfie, setPartnerSelfie] = useState<File | null>(null);
  const [partnerPreview, setPartnerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [matchProgress, setMatchProgress] = useState<{ processed: number; total: number } | null>(
    null,
  );
  const [pastRuns, setPastRuns] = useState<MatchRunSummary[]>([]);

  const loginNext = slug ? `/e/${slug}` : "/";
  const loginHref = `/login?next=${encodeURIComponent(loginNext)}`;

  const branding = useMemo(() => {
    const b = event?.branding ?? {};
    return {
      coupleNames: typeof b.couple_names === "string" ? b.couple_names : null,
      accent: typeof b.accent_color === "string" ? b.accent_color : null,
    };
  }, [event]);

  const hasPortrait = coupleMode
    ? Boolean(selfie) && Boolean(partnerSelfie)
    : Boolean(selfie);

  useEffect(() => {
    if (!selfie) {
      setSelfiePreview(null);
      return;
    }
    const url = URL.createObjectURL(selfie);
    setSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfie]);

  useEffect(() => {
    if (!partnerSelfie) {
      setPartnerPreview(null);
      return;
    }
    const url = URL.createObjectURL(partnerSelfie);
    setPartnerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [partnerSelfie]);

  useEffect(() => {
    if (!slug) {
      return;
    }
    setLoadingEvent(true);
    fetchEventBySlug(slug)
      .then((row) => {
        setEvent(row);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Event not found");
      })
      .finally(() => setLoadingEvent(false));
  }, [slug]);

  useEffect(() => {
    if (!event) {
      return;
    }
    void (async () => {
      try {
        const token = await getAccessToken();
        const runs = await fetchMyEventRuns(event.id, { token, anonymousSessionId });
        setPastRuns(runs);
      } catch {
        setPastRuns([]);
      }
    })();
  }, [event, session, anonymousSessionId, getAccessToken]);

  async function handleMatch() {
    if (!event || !selfie) {
      return;
    }

    setLoading(true);
    setError(null);
    setStep("results");
    setMatchProgress({ processed: 0, total: photoCount });
    setResult({
      reference_face_detected: true,
      threshold: event.default_threshold,
      total_gallery: photoCount,
      matched: [],
      skipped: [],
      couple_mode: coupleMode,
      event_id: event.id,
    });

    try {
      const token = await getAccessToken();
      const auth = { token, anonymousSessionId };
      const response = await matchEventPhotosStream(
        event.id,
        {
          selfie,
          partnerSelfie: coupleMode ? partnerSelfie : null,
          threshold: event.default_threshold,
        },
        auth,
        (event) => {
          if (event.type === "progress") {
            setMatchProgress({ processed: event.processed, total: event.total });
          }
          if (event.type === "match") {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    matched: [...prev.matched, event.photo],
                  }
                : null,
            );
          }
          if (event.type === "complete") {
            setResult(event.result);
          }
        },
      );
      setResult(response);
      const runs = await fetchMyEventRuns(event.id, auth);
      setPastRuns(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("portrait");
      setResult(null);
    } finally {
      setLoading(false);
      setMatchProgress(null);
    }
  }

  if (loadingEvent) {
    return (
      <div className="event-guest event-guest--loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-guest event-guest--state">
        <div className="event-guest__state-card">
          <h1>Event not found</h1>
          <p>{error ?? "This link may be incorrect or the event is not public yet."}</p>
          <Link className="btn btn-secondary" to="/">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const title = branding.coupleNames ?? event.title;
  const photoCount = event.gallery_photo_count ?? 0;

  if (event.status === "archived") {
    return (
      <div
        className="event-guest event-guest--state"
        style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
      >
        <div className="event-guest__state-card">
          <h1>{title}</h1>
          <p className="event-guest__state-lead">This event has ended.</p>
          <p>Photo matching is no longer available. Thank you for celebrating with us.</p>
        </div>
      </div>
    );
  }

  if (photoCount === 0) {
    return (
      <div
        className="event-guest event-guest--state"
        style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
      >
        <div className="event-guest__state-card">
          <h1>{title}</h1>
          <p className="event-guest__state-lead">Album still uploading</p>
          <p>The wedding photos are being added. Check back in a little while.</p>
        </div>
      </div>
    );
  }

  const noMatches = step === "results" && result && result.matched.length === 0;

  return (
    <div
      className={`event-guest${step === "results" ? " event-guest--results" : ""}`}
      style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
    >
      <InstallPrompt />

      {step === "portrait" && (
        <header className="event-guest__header">
          <p className="event-guest__eyebrow">{title}</p>
          <h1>Find your photos</h1>
          {event.wedding_date && (
            <p className="event-guest__date">{new Date(event.wedding_date).toLocaleDateString()}</p>
          )}
          <p className="event-guest__desc">Upload a clear selfie to search {photoCount} wedding photos.</p>
        </header>
      )}

      {step === "results" && (
        <header className="event-guest__header event-guest__header--compact">
          <p className="event-guest__eyebrow">{title}</p>
          <h1>{noMatches ? "No matches yet" : "Your photos"}</h1>
        </header>
      )}

      <div className="event-guest__content">
        {step === "portrait" && (
          <>
            {pastRuns.length > 0 && (
              <div className="event-guest__past">
                <h2>My past searches</h2>
                <ul>
                  {pastRuns.map((run) => (
                    <li key={run.id}>
                      {run.share_id ? (
                        <Link to={`/share/${run.share_id}`}>
                          {formatRunDate(run.created_at)} · {run.matched_count} photo
                          {run.matched_count === 1 ? "" : "s"}
                        </Link>
                      ) : (
                        <span>
                          {formatRunDate(run.created_at)} · {run.matched_count} matches
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SelfieUpload
              file={selfie}
              previewUrl={selfiePreview}
              onChange={setSelfie}
              partnerFile={partnerSelfie}
              partnerPreviewUrl={partnerPreview}
              onPartnerChange={setPartnerSelfie}
              coupleMode={coupleMode}
              onCoupleModeChange={setCoupleMode}
              onContinue={handleMatch}
              hasGallery
            />
            <button
              type="button"
              className="btn btn-primary event-guest__match"
              disabled={!hasPortrait || loading}
              onClick={() => void handleMatch()}
            >
              {loading ? "Searching…" : "Find my photos"}
            </button>
          </>
        )}

        {step === "results" && (
          <>
            {noMatches ? (
              <div className="event-guest__empty-results">
                <p>No photos found — try a clearer selfie with your face well lit and facing the camera.</p>
              </div>
            ) : (
              <ResultsGrid
                result={result}
                loading={loading}
                onStartSearch={handleMatch}
                canMatch={hasPortrait}
                guestMode
                eventId={event.id}
                auth={{ anonymousSessionId }}
                matchProgress={matchProgress}
              />
            )}

            {!session && (
              <div className="event-guest__save">
                <p>Save these results to your account</p>
                <Link className="btn btn-primary" to={loginHref}>
                  Sign in to save
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void signInWithGoogle(loginNext)}
                >
                  Continue with Google
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary event-guest__back"
              onClick={() => {
                setStep("portrait");
                setError(null);
              }}
            >
              Search again
            </button>
          </>
        )}

        {error && <p className="error-banner">{error}</p>}
      </div>

      {step === "portrait" && (
        <p className="event-guest__privacy">Your selfie is processed in memory and never stored.</p>
      )}
    </div>
  );
}
