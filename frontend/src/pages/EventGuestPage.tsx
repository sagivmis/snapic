import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchEventBySlug, fetchMyEventRuns, matchEventPhotosStream, ApiError } from "../api/client";
import { InstallPrompt } from "../components/InstallPrompt";
import { EventGuestSkeleton } from "../components/EventGuestSkeleton";
import { GuestPageHero } from "../components/GuestPageHero";
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
import { useTranslation } from "../i18n";
import { isGallerySearchReady } from "../types";
import {
  guestDisplayTitle,
  guestPageRootClassName,
  guestPageRootStyle,
  parseGuestBranding,
} from "../utils/guestBranding";
import "../styles/EventGuest.scss";

type GuestStep = "portrait" | "results";

interface EventGuestPageProps {
  /** When true, renders inside the preview iframe without app chrome (route: /e/:slug/preview). */
  embed?: boolean;
}

export function EventGuestPage({ embed = false }: EventGuestPageProps) {
  const { t, tPath } = useTranslation("events.guest");
  const { tPath: tCommon } = useTranslation("events.common");
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

  const loadEventRow = useCallback(
    async (slugValue: string) => {
      const useAuth = embed || Boolean(session);
      const token = useAuth ? await getAccessToken() : null;
      return fetchEventBySlug(slugValue, token);
    },
    [embed, session, getAccessToken],
  );

  const branding = useMemo(() => parseGuestBranding(event?.branding), [event?.branding]);
  const pageStyle = guestPageRootStyle(branding.accent);

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
    void loadEventRow(slug)
      .then((row) => {
        setEvent(row);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : tPath("eventNotFound"));
      })
      .finally(() => setLoadingEvent(false));
  }, [slug, loadEventRow, tPath]);

  useEffect(() => {
    if (!slug || !event) {
      return;
    }
    const photoCount = event.gallery_photo_count ?? 0;
    if (photoCount === 0 || isGallerySearchReady(event)) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadEventRow(slug)
        .then((row) => setEvent(row))
        .catch(() => {});
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [slug, event?.gallery_search_ready, event?.gallery_indexing_in_progress, event?.unindexed_photo_count, event?.gallery_photo_count, loadEventRow]);

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
      void loadEventRow(slug)
        .then((row) => setEvent(row))
        .catch(() => {});
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [slug, event?.id, event?.gallery_search_ready, lastSearchGalleryCount, pastRuns.length, loadEventRow]);

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
      const row = await loadEventRow(slug);
      setEvent(row);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("refreshFailed"));
    } finally {
      setRefreshingEvent(false);
    }
  }

  async function handleMatch() {
    if (!event || !selfie || !network.online) {
      return;
    }
    if (!isGallerySearchReady(event)) {
      setError(tPath("albumNotReady"));
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
        setError(tPath("rateLimited"));
      } else if (err instanceof ApiError && err.status === 503) {
        setError(tPath("albumNotReadyRetry"));
        void refreshEvent();
      } else {
        setError(err instanceof Error ? err.message : t("somethingWentWrong"));
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
          <h1>{tPath("notFoundTitle")}</h1>
          <p>{error ?? tPath("notFoundLead")}</p>
          <Link className="btn btn-secondary" to="/">
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const title = guestDisplayTitle(branding, event.title, tCommon("defaultGalleryTitle"));
  const photoCount = event.gallery_photo_count ?? 0;
  const org = event.organization;

  const studioCoBrand = org ? (
    <div className="event-guest__studio-brand">
      {org.logo_url && (
        <img src={org.logo_url} alt="" className="event-guest__studio-logo" />
      )}
      <p className="event-guest__studio-name">{org.name}</p>
      {org.website_url && (
        <a href={org.website_url} target="_blank" rel="noreferrer" className="event-guest__studio-link">
          {tCommon("photosBy", { name: org.name })}
        </a>
      )}
    </div>
  ) : null;

  const rootClass = (extra?: string) =>
    guestPageRootClassName(branding.decorationTheme, Boolean(branding.accent), extra);

  if (event.status === "closed") {
    return (
      <div className={rootClass("event-guest--state")} style={pageStyle}>
        <GuestPageHero
          displayName={title}
          weddingDate={event.wedding_date}
          welcomeMessage={branding.welcomeMessage}
          headline={tPath("closedLead")}
          decorationTheme={branding.decorationTheme}
          studioBrand={studioCoBrand}
        />
        <div className="event-guest__state-card">
          <p>{tPath("closedDetail")}</p>
        </div>
      </div>
    );
  }

  if (photoCount === 0) {
    return (
      <div className={rootClass("event-guest--state")} style={pageStyle}>
        <GuestPageHero
          displayName={title}
          weddingDate={event.wedding_date}
          welcomeMessage={branding.welcomeMessage}
          headline={tPath("photosComingSoon")}
          description={tPath("photosComingSoonDetail")}
          decorationTheme={branding.decorationTheme}
          studioBrand={studioCoBrand}
        />
        <div className="event-guest__state-card">
          <div className="event-guest__state-icon" aria-hidden="true">📷</div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={refreshingEvent}
            onClick={() => void refreshEvent()}
          >
            {refreshingEvent ? t("checking") : tPath("checkAgain")}
          </button>
        </div>
      </div>
    );
  }

  if (!isGallerySearchReady(event)) {
    const unindexed = event.unindexed_photo_count ?? 0;
    const indexing = event.gallery_indexing_in_progress === true;
    const preparingDetail =
      unindexed > 0
        ? tPath(unindexed === 1 ? "preparingPhotos_one" : "preparingPhotos_other", {
            count: unindexed,
          })
        : indexing
          ? tPath("indexingAlbum")
          : tPath("preparingAlbum");

    return (
      <div className={rootClass("event-guest--state")} style={pageStyle}>
        <GuestPageHero
          displayName={title}
          weddingDate={event.wedding_date}
          welcomeMessage={branding.welcomeMessage}
          headline={tPath("galleryAlmostReady")}
          description={preparingDetail}
          decorationTheme={branding.decorationTheme}
          studioBrand={studioCoBrand}
        />
        <div className="event-guest__state-card">
          <div className="event-guest__state-icon" aria-hidden="true">⏳</div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={refreshingEvent}
            onClick={() => void refreshEvent()}
          >
            {refreshingEvent ? t("checking") : tPath("checkAgain")}
          </button>
        </div>
      </div>
    );
  }

  const showCompactHeader =
    step === "results" && !loading && result && result.matched.length === 0;

  const showSnapicFooter = !org || org.branding_tier === "standard";
  const showMinSnapicFooter = org?.branding_tier === "pro";

  return (
    <div
      className={rootClass(step === "results" ? "event-guest--results" : undefined)}
      style={pageStyle}
    >
      {!embed && <InstallPrompt />}
      {!embed && <GuestSearchHistory runs={pastRuns} />}

      {!network.online && (
        <div className="event-guest__network-banner event-guest__network-banner--offline" role="status">
          {tPath("offlineBanner")}
        </div>
      )}
      {network.online && network.isSlowConnection && (loading || step === "portrait") && (
        <div className="event-guest__network-banner" role="status">
          {tPath("slowConnectionBanner")}
        </div>
      )}
      {searchStale && loading && (
        <div className="event-guest__network-banner event-guest__network-banner--patience" role="status">
          {tPath("stillSearchingBanner")}
        </div>
      )}
      {newPhotosAvailable && !loading && (
        <div className="event-guest__new-photos-banner" role="status">
          <p>
            {newPhotoCount > 0
              ? tPath(newPhotoCount === 1 ? "newPhotosBanner_one" : "newPhotosBanner_other", {
                  count: newPhotoCount,
                })
              : tPath("newPhotosBannerGeneric")}
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
              {tPath("searchAgain")}
            </button>
          )}
        </div>
      )}

      {step === "portrait" && (
        <GuestPageHero
          displayName={title}
          weddingDate={event.wedding_date}
          welcomeMessage={branding.welcomeMessage}
          headline={tPath("findYourPhotos")}
          description={tPath("uploadSelfieDesc", { count: photoCount })}
          decorationTheme={branding.decorationTheme}
          studioBrand={studioCoBrand}
        />
      )}

      {step === "results" && (
        <GuestPageHero
          displayName={title}
          weddingDate={event.wedding_date}
          welcomeMessage={branding.welcomeMessage}
          headline={showCompactHeader ? tPath("noMatchesYet") : tPath("yourPhotos")}
          compact
          decorationTheme={branding.decorationTheme}
          studioBrand={studioCoBrand}
        />
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
              {!network.online ? t("offline") : loading ? tPath("searching") : tPath("findMyPhotos")}
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
                <p className="event-guest__tips-title">{tPath("tipsTitle")}</p>
                <ul>
                  <li>{tPath("tip1")}</li>
                  <li>{tPath("tip2")}</li>
                  <li>{tPath("tip3")}</li>
                </ul>
              </div>
            )}

            {!session && !loading && result && result.matched.length > 0 && (
              <div className="event-guest__save">
                <p>{tPath("saveResults")}</p>
                <Link className="btn btn-primary" to={loginHref}>
                  {tPath("signInToSave")}
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void signInWithGoogle(loginNext)}
                >
                  {t("continueGoogle")}
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
              {tPath("searchAgain")}
            </button>
          </>
        )}

        {error && (
          <p className={`error-banner${rateLimited ? " error-banner--rate-limit" : ""}`}>{error}</p>
        )}
      </div>

      {step === "portrait" && (
        <p className="event-guest__privacy">{tPath("privacy")}</p>
      )}
      {(showSnapicFooter || showMinSnapicFooter) && (
        <footer className="event-guest__powered">
          {showMinSnapicFooter ? (
            <a href="https://snapic.app">Snapic</a>
          ) : (
            <span>{tCommon("poweredBy")}</span>
          )}
        </footer>
      )}
    </div>
  );
}
