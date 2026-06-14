import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchEventBySlug, matchEventPhotos } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { InstallPrompt } from "../components/InstallPrompt";
import { ResultsGrid } from "../components/ResultsGrid";
import { SelfieUpload } from "../components/SelfieUpload";
import type { EventPublic, MatchResponse } from "../types";
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

  async function handleMatch() {
    if (!event || !selfie) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await matchEventPhotos(
        event.id,
        {
          selfie,
          partnerSelfie: coupleMode ? partnerSelfie : null,
          threshold: event.default_threshold,
        },
        { token, anonymousSessionId },
      );
      setResult(response);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
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
      <div className="event-guest">
        <p className="error-banner">{error ?? "Event not found"}</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  const title = branding.coupleNames ?? event.title;

  return (
    <div
      className="event-guest"
      style={branding.accent ? ({ "--event-accent": branding.accent } as CSSProperties) : undefined}
    >
      <InstallPrompt />
      <header className="event-guest__header">
        <p className="event-guest__eyebrow">
          {step === "portrait" ? "Step 1 of 2" : "Step 2 of 2"}
        </p>
        <h1>{title}</h1>
        {event.wedding_date && (
          <p className="event-guest__date">{new Date(event.wedding_date).toLocaleDateString()}</p>
        )}
        <p className="event-guest__desc">
          {step === "portrait"
            ? "Upload a selfie to find photos of you in this wedding gallery."
            : "Your matching photos from the event."}
        </p>
      </header>

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
              disabled={!hasPortrait || loading}
              onClick={() => void handleMatch()}
            >
              {loading ? "Searching…" : "Find my photos"}
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
            />
            {!session && (
              <div className="event-guest__save">
                <p>Save these results to your account</p>
                <Link className="btn btn-secondary" to="/login">
                  Sign in with email
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void signInWithGoogle()}
                >
                  Continue with Google
                </button>
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost event-guest__back"
              onClick={() => setStep("portrait")}
            >
              Search again
            </button>
          </>
        )}

        {error && <p className="error-banner">{error}</p>}
      </div>

      <p className="event-guest__privacy">
        Your selfie is processed in memory and never stored.
      </p>
    </div>
  );
}
