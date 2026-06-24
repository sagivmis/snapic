import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchEventBySlug, fetchMyEventRuns, matchEventPhotosStream, ApiError } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { EventGuestSkeleton } from "../components/EventGuestSkeleton";
import { GuestSearchHistory } from "../components/GuestSearchHistory";
import { ResultsGrid } from "../components/ResultsGrid";
import { SelfieUpload } from "../components/SelfieUpload";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  countNewPhotosSinceLastSearch,
  hasNewPhotosSinceLastSearch,
  galleryAtLastSearch,
  recordGalleryAtSearch,
} from "../utils/guestSearchBaseline";
import type { EventPublic, MatchResponse, MatchRunSummary } from "../types";
import { isGallerySearchReady } from "../types";
import "../styles/EventGuest.scss";

type GuestStep = "portrait" | "results";

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
  const [refreshingEvent, setRefreshingEvent] = useState(false);
  const [searchStale, setSearchStale] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const lastProgressAtRef = useRef(Date.now());
  const network = useNetworkStatus();

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
    if (!slug || !event) {
      return;
    }
    const photoCount = event.gallery_photo_count ?? 0;
    if (photoCount === 0 || isGallerySearchReady(event)) {
      return;
    }
    const interval = window.setInterval(() => {
      void fetchEventBySlug(slug)
        .then((row) => setEvent(row))
        .catch(() => {});
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [slug, event?.gallery_search_ready, event?.gallery_indexing_in_progress, event?.unindexed_photo_count, event?.gallery_photo_count]);

  const lastSearchGalleryCount = useMemo(() => {
    if (!event) {
      return 0;
    }
    return galleryAtLastSearch(event.id, pastRuns);
  }, [event, pastRuns]);

  const newPhotosAvailable = useMemo(() => {
    if (!event || loading || !isGallerySearchReady(event)) {
      return false;
    }
    return hasNewPhotosSinceLastSearch(event.gallery_photo_count ?? 0, event.id, pastRuns);
  }, [event, pastRuns, loading]);

  const newPhotoCount = useMemo(() => {
    if (!event) {
      return 0;
    }
    return countNewPhotosSinceLastSearch(event.gallery_photo_count ?? 0, event.id, pastRuns);
  }, [event, pastRuns]);

  useEffect(() => {
    if (!slug || !event || !isGallerySearchReady(event)) {
      return;
    }
    if (lastSearchGalleryCount <= 0 && pastRuns.length === 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void fetchEventBySlug(slug)
        .then((row) => setEvent(row))
        .catch(() => {});
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [slug, event?.id, event?.gallery_search_ready, lastSearchGalleryCount, pastRuns.length]);

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

  useEffect(() => {
    if (!loading) {
      setSearchStale(false);
      return;
    }

    lastProgressAtRef.current = Date.now();
    setSearchStale(false);

    const timer = window.setInterval(() => {
      if (Date.now() - lastProgressAtRef.current > 12_000) {
        setSearchStale(true);
      }
    }, 3_000);

    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (matchProgress) {
      lastProgressAtRef.current = Date.now();
      setSearchStale(false);
    }
  }, [matchProgress?.processed, matchProgress?.total]);

  async function refreshEvent() {
    if (!slug) {
      return;
    }
    setRefreshingEvent(true);
    try {
      const row = await fetchEventBySlug(slug);
      setEvent(row);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh event");
    } finally {
      setRefreshingEvent(false);
    }
  }

  async function handleMatch() {
    if (!event || !selfie || !network.online) {
      return;
    }
    if (!isGallerySearchReady(event)) {
      setError(
        "The wedding album is still being prepared for search. Please check back in a few minutes.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setRateLimited(false);
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
      recordGalleryAtSearch(event.id, response.total_gallery);
      const runs = await fetchMyEventRuns(event.id, auth);
      setPastRuns(runs);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimited(true);
        setError(
          "You've reached the search limit for this hour. Please wait about an hour before trying again.",
        );
      } else if (err instanceof ApiError && err.status === 503) {
        setError(
          "The wedding album is still being prepared for search. Please wait a few minutes and try again.",
        );
        void refreshEvent();
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setStep("portrait");
      setResult(null);
    } finally {
      setLoading(false);
      setMatchProgress(null);
    }
  }

  if (loadingEvent) {
    return <EventGuestSkeleton />;
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

  if (event.status === "closed") {
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
          <div className="event-guest__state-icon" aria-hidden="true">
            📷
          </div>
          <h1>{title}</h1>
          <p className="event-guest__state-lead">Photos coming soon</p>
          <p>The album is still being uploaded. Check back in a few minutes — the photographer is adding photos now.</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={refreshingEvent}
            onClick={() => void refreshEvent()}
          >
            {refreshingEvent ? "Checking…" : "Check again"}
          </button>
        </div>
      </div>
    );
  }

  if (!isGallerySearchReady(event)) {
    const unindexed = event.unindexed_photo_count ?? 0;
    const indexing = event.gallery_indexing_in_progress === true;
    return (
      <div
        className="event-guest event-guest--state"
        style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
      >
        <div className="event-guest__state-card">
          <div className="event-guest__state-icon" aria-hidden="true">
            ⏳
          </div>
          <h1>{title}</h1>
          <p className="event-guest__state-lead">Gallery almost ready</p>
          <p>
            {unindexed > 0
              ? `We're preparing ${unindexed} photo${unindexed === 1 ? "" : "s"} for face search — this usually takes a few minutes after upload.`
              : indexing
                ? "We're indexing the album for face search. This usually takes a few minutes."
                : "We're preparing the album for face search. This usually takes a few minutes after upload."}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={refreshingEvent}
            onClick={() => void refreshEvent()}
          >
            {refreshingEvent ? "Checking…" : "Check again"}
          </button>
        </div>
      </div>
    );
  }

  const showCompactHeader =
    step === "results" && !loading && result && result.matched.length === 0;

  const org = event.organization;
  const showSnapicFooter = !org || org.branding_tier === "standard";
  const showMinSnapicFooter = org?.branding_tier === "pro";

  const studioCoBrand = org ? (
    <div className="event-guest__studio-brand">
      <p className="event-guest__studio-name">{org.name}</p>
      {org.website_url && (
        <a href={org.website_url} target="_blank" rel="noreferrer" className="event-guest__studio-link">
          Photos by {org.name}
        </a>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`event-guest${step === "results" ? " event-guest--results" : ""}`}
      style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
    >
      <InstallPrompt />
      <GuestSearchHistory runs={pastRuns} />

      {!network.online && (
        <div className="event-guest__network-banner event-guest__network-banner--offline" role="status">
          You&apos;re offline. Reconnect to search or download photos.
        </div>
      )}
      {network.online && network.isSlowConnection && (loading || step === "portrait") && (
        <div className="event-guest__network-banner" role="status">
          Slow connection detected — searching may take a little longer.
        </div>
      )}
      {searchStale && loading && (
        <div className="event-guest__network-banner event-guest__network-banner--patience" role="status">
          Still searching a large album. Matches will keep appearing as we find them.
        </div>
      )}
      {newPhotosAvailable && !loading && (
        <div className="event-guest__new-photos-banner" role="status">
          <p>
            {newPhotoCount > 0
              ? `${newPhotoCount} new photo${newPhotoCount === 1 ? "" : "s"} were added since your last search.`
              : "New photos were added since your last search."}{" "}
            Search again to find more.
          </p>
          {step === "results" && (
            <button
              type="button"
              className="btn btn-secondary event-guest__new-photos-action"
              disabled={!hasPortrait || !network.online}
              onClick={() => {
                setStep("portrait");
                void handleMatch();
              }}
            >
              Search again
            </button>
          )}
        </div>
      )}

      {step === "portrait" && (
        <header className="event-guest__header">
          {studioCoBrand}
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
          {studioCoBrand}
          <p className="event-guest__eyebrow">{title}</p>
          <h1>{showCompactHeader ? "No matches yet" : "Your photos"}</h1>
        </header>
      )}

      <div className="event-guest__content">
        {step === "portrait" && (
          <>
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
              disabled={!hasPortrait || loading || !network.online}
              onClick={() => void handleMatch()}
            >
              {!network.online ? "Offline" : loading ? "Searching…" : "Find my photos"}
            </button>
          </>
        )}

        {step === "results" && (
          <>
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

            {!loading && result && result.matched.length === 0 && (
              <div className="event-guest__tips">
                <p className="event-guest__tips-title">Tips for a better match</p>
                <ul>
                  <li>Use a well-lit photo with your face clearly visible</li>
                  <li>Look straight at the camera, without sunglasses or a mask</li>
                  <li>Try a different selfie if this one was blurry or far away</li>
                </ul>
              </div>
            )}

            {!session && !loading && result && result.matched.length > 0 && (
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

        {error && (
          <p className={`error-banner${rateLimited ? " error-banner--rate-limit" : ""}`}>{error}</p>
        )}
      </div>

      {step === "portrait" && (
        <p className="event-guest__privacy">Your selfie is processed in memory and never stored.</p>
      )}
      {(showSnapicFooter || showMinSnapicFooter) && (
        <footer className="event-guest__powered">
          {showMinSnapicFooter ? (
            <a href="https://snapic.app">Snapic</a>
          ) : (
            <span>Powered by Snapic</span>
          )}
        </footer>
      )}
    </div>
  );
}
