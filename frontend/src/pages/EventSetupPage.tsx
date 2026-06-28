import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  buildEventGuestUrl,
  fetchEventBySlug,
  fetchEventSetupStatus,
  inviteEventMember,
  reindexEventGallery,
  updateEvent,
} from "../api/client";
import { IndexFacesProgress } from "../components/IndexFacesProgress";
import { AlbumStatusBanner } from "../components/AlbumStatusBanner";
import { DecorationThemePicker } from "../components/DecorationThemePicker";
import { GuestPreviewSheet } from "../components/GuestPreviewSheet";
import { HelpDrawer, type HelpTopic } from "../components/HelpDrawer";
import { ShareSheet } from "../components/ShareSheet";
import { useAuth } from "../auth/AuthProvider";
import type { EventPublic, EventSetupStatus } from "../types";
import type { IndexStreamEvent } from "../api/client";
import { useTranslation } from "../i18n";
import { track } from "../lib/analytics";
import { formatIndexResult } from "../utils/galleryFaceIndex";
import { getNextSetupAction } from "../utils/onboarding";
import { canManageEvent } from "../utils/eventAccess";
import { type DecorationTheme, parseGuestBranding } from "../utils/guestBranding";
import "../styles/EventSetup.scss";

function buildBrandingPatch(
  event: EventPublic,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(event.branding ?? {}), ...patch };
}

type ProgressKey = "branding" | "photos" | "live" | "share";

export function EventSetupPage() {
  const { t, tPath } = useTranslation("events.setup");
  const { tPath: tManage } = useTranslation("events.manage");
  const { tPath: tHelp } = useTranslation("events.setup.help");
  const { tPath: tBranding } = useTranslation("events.common.branding");
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { session, getAccessToken, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [setupStatus, setSetupStatus] = useState<EventSetupStatus | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [busy, setBusy] = useState(false);
  const [indexProgress, setIndexProgress] = useState<Extract<
    IndexStreamEvent,
    { type: "progress" }
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showBrandingForm, setShowBrandingForm] = useState(false);
  const [showCoadmin, setShowCoadmin] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [title, setTitle] = useState("");
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [accentColor, setAccentColor] = useState("#c9a962");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [decorationTheme, setDecorationTheme] = useState<DecorationTheme>("classic");
  const [inviteEmail, setInviteEmail] = useState("");

  const guestUrl = useMemo(() => (slug ? buildEventGuestUrl(slug) : ""), [slug]);
  const nextAction = useMemo(
    () => (setupStatus ? getNextSetupAction(setupStatus) : null),
    [setupStatus],
  );

  const progress: Record<ProgressKey, boolean> = useMemo(() => {
    if (!setupStatus) {
      return { branding: false, photos: false, live: false, share: false };
    }
    return {
      branding: Boolean(setupStatus.branding_ok),
      photos: Boolean(setupStatus.has_photos && setupStatus.faces_indexed),
      live: Boolean(setupStatus.is_active),
      share: Boolean(setupStatus.is_active && setupStatus.faces_indexed),
    };
  }, [setupStatus]);

  const refreshSetupStatus = useCallback(async () => {
    if (!event) {
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    setSetupStatus(await fetchEventSetupStatus(event.id, token));
  }, [event, getAccessToken]);

  const sessionUserId = session?.user?.id;

  const load = useCallback(async () => {
    if (!slug || !sessionUserId) {
      setBootstrapping(false);
      return;
    }
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const ev = await fetchEventBySlug(slug, token);
      setEvent(ev);
      setTitle(ev.title);
      setWeddingDate(ev.wedding_date ?? "");
      const eventBranding = parseGuestBranding(ev.branding);
      setCoupleNames(eventBranding.coupleNames ?? "");
      setAccentColor(eventBranding.accent ?? "#c9a962");
      setWelcomeMessage(eventBranding.welcomeMessage ?? "");
      setDecorationTheme(eventBranding.decorationTheme);

      if (ev.onboarding_completed_at) {
        navigate(`/e/${slug}/manage`, { replace: true });
        return;
      }

      const hasMembership = await canManageEvent(ev, token, isSuperAdmin);
      setIsAdmin(hasMembership);
      if (!hasMembership) {
        setError(tPath("noPermission"));
        return;
      }

      const status = await fetchEventSetupStatus(ev.id, token);
      setSetupStatus(status);
      setShowBrandingForm(!status.branding_ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setBootstrapping(false);
    }
  }, [slug, sessionUserId, getAccessToken, isSuperAdmin, navigate, t, tPath]);

  useEffect(() => {
    if (!slug || !sessionUserId) {
      setBootstrapping(false);
      return;
    }
    setBootstrapping(true);
    void load();
  }, [slug, sessionUserId, load]);

  useEffect(() => {
    function handleReturn() {
      if (showPreview) {
        return;
      }
      if (document.visibilityState === "visible") {
        void refreshSetupStatus();
      }
    }
    document.addEventListener("visibilitychange", handleReturn);
    window.addEventListener("focus", handleReturn);
    return () => {
      document.removeEventListener("visibilitychange", handleReturn);
      window.removeEventListener("focus", handleReturn);
    };
  }, [refreshSetupStatus, showPreview]);

  useEffect(() => {
    if (!event) {
      return;
    }
    const needsPoll =
      busy ||
      setupStatus?.indexing_in_progress ||
      (setupStatus?.unindexed_count ?? 0) > 0;
    if (!needsPoll) {
      return;
    }
    const interval = window.setInterval(() => void refreshSetupStatus(), 5000);
    return () => window.clearInterval(interval);
  }, [event, setupStatus, busy, refreshSetupStatus]);

  async function handleBrandingSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!event) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await updateEvent(
        event.id,
        {
          title,
          wedding_date: weddingDate || null,
          branding: buildBrandingPatch(event, {
            couple_names: coupleNames,
            accent_color: accentColor,
            welcome_message: welcomeMessage,
            decoration_theme: decorationTheme,
            onboarding_step: "ready",
          }),
        },
        token,
      );
      setEvent(updated);
      setShowBrandingForm(false);
      track("couple_home_branding_saved");
      await refreshSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("brandingSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!event || !inviteEmail.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await inviteEventMember(event.id, inviteEmail.trim(), token);
      setInviteEmail("");
      setInviteSent(true);
      track("couple_home_coadmin_invited");
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("inviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleIndexFaces() {
    if (!event) {
      return;
    }
    setBusy(true);
    setIndexProgress(null);
    setError(null);
    setNotice(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const result = await reindexEventGallery(event.id, token, (p) => setIndexProgress(p));
      await refreshSetupStatus();
      const latest = await fetchEventSetupStatus(event.id, token);
      setSetupStatus(latest);

      if (latest.faces_indexed) {
        setNotice(tPath("indexReadyNotice", { result: formatIndexResult(result) }));
        return;
      }
      if (result.processed === 0 && result.indexed === 0) {
        setError(tPath("indexNoPhotos"));
        return;
      }
      setNotice(tPath("indexPartialNotice", { result: formatIndexResult(result), remaining: latest.unindexed_count }));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("indexFailed"));
    } finally {
      setBusy(false);
      setIndexProgress(null);
    }
  }

  async function handleGoLive() {
    if (!event) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await updateEvent(event.id, { status: "active" }, token);
      setEvent(updated);
      track("couple_home_went_live");
      await refreshSetupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("activateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinishSetup() {
    if (!event) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await updateEvent(
        event.id,
        {
          complete_onboarding: true,
          branding: buildBrandingPatch(event, { onboarding_step: "ready" }),
        },
        token,
      );
      navigate(`/e/${slug}/live`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("finishFailed"));
    } finally {
      setBusy(false);
    }
  }

  const overlays = (
    <>
      <GuestPreviewSheet open={showPreview} slug={slug} onClose={() => setShowPreview(false)} />
      <ShareSheet
        open={showShare}
        url={guestUrl}
        eventTitle={event?.title}
        coupleNames={coupleNames}
        onClose={() => setShowShare(false)}
      />
      <HelpDrawer
        open={showHelp}
        onClose={() => setShowHelp(false)}
        topics={buildHelpTopics(tHelp, {
          openPreview: () => setShowPreview(true),
          openCoadmin: () => setShowCoadmin(true),
          goToAlbum: () => navigate(`/e/${slug}/manage?from=setup&tab=album`),
        })}
      />
    </>
  );

  if (bootstrapping) {
    return (
      <>
        <div className="event-setup event-setup--loading">
          <span className="spinner spinner-lg" />
        </div>
        {overlays}
      </>
    );
  }

  if (!event || !isAdmin) {
    return (
      <>
        <div className="event-setup">
          <div className="event-setup__card">
            <h1>{tPath("title")}</h1>
            <p>{error ?? tPath("loadFailed")}</p>
            <Link to="/" className="btn btn-secondary">
              {t("backHome")}
            </Link>
          </div>
        </div>
        {overlays}
      </>
    );
  }

  const displayNames = coupleNames || title || tPath("coupleHome.untitled");
  const allComplete = nextAction?.action === "complete";

  const progressItems: { key: ProgressKey; label: string }[] = [
    { key: "branding", label: tPath("coupleHome.progress.branding") },
    { key: "photos", label: tPath("coupleHome.progress.photos") },
    { key: "live", label: tPath("coupleHome.progress.live") },
    { key: "share", label: tPath("coupleHome.progress.share") },
  ];

  return (
    <div
      className="event-setup couple-home"
      style={{ "--event-accent": accentColor } as CSSProperties}
    >
      <div className="event-setup__shell">
        <header className="event-setup__header">
          <div className="event-setup__header-top">
            <p className="event-setup__eyebrow">{tPath("coupleHome.eyebrow")}</p>
            <div className="event-setup__header-actions">
              <button
                type="button"
                className="help-pill"
                onClick={() => {
                  setShowHelp(true);
                  track("couple_home_help_opened");
                }}
              >
                {tHelp("trigger")}
              </button>
              {isSuperAdmin && (
                <Link className="event-setup__admin-link" to="/admin">
                  {tManage("adminDashboard")}
                </Link>
              )}
            </div>
          </div>
          <h1>{displayNames}</h1>
          <button
            type="button"
            className="couple-home__preview-link"
            onClick={() => {
              setShowPreview(true);
              track("couple_home_preview_opened");
            }}
          >
            {tPath("coupleHome.previewAsGuest")} ↗
          </button>

          <ol className="couple-home__progress">
            {progressItems.map((item, idx) => (
              <li
                key={item.key}
                className={`couple-home__progress-step${
                  progress[item.key] ? " couple-home__progress-step--done" : ""
                }`}
              >
                <span className="couple-home__progress-dot" aria-hidden="true">
                  {progress[item.key] ? "✓" : idx + 1}
                </span>
                <span className="couple-home__progress-label">{item.label}</span>
              </li>
            ))}
          </ol>
        </header>

        {/* NEXT STEP: the single big CTA */}
        <section className="couple-home__next-card">
          <p className="couple-home__next-eyebrow">
            {allComplete ? tPath("coupleHome.nextStepReady") : tPath("coupleHome.nextStepLabel")}
          </p>
          <h2 className="couple-home__next-title">
            {allComplete ? tPath("coupleHome.nextStepReadyLead") : nextAction?.label}
          </h2>

          {nextAction && (
            <div className="couple-home__next-actions">
              {nextAction.action === "upload" && (
                <Link to={`/e/${slug}/manage?from=setup&tab=album`} className="btn btn-primary couple-home__big-btn">
                  {nextAction.label}
                </Link>
              )}
              {nextAction.action === "index" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary couple-home__big-btn"
                    disabled={busy}
                    onClick={() => void handleIndexFaces()}
                  >
                    {busy && indexProgress ? nextAction.busyLabel : nextAction.label}
                  </button>
                  <IndexFacesProgress progress={indexProgress} />
                </>
              )}
              {nextAction.action === "activate" && (
                <button
                  type="button"
                  className="btn btn-primary couple-home__big-btn"
                  disabled={busy}
                  onClick={() => void handleGoLive()}
                >
                  {busy ? nextAction.busyLabel : nextAction.label}
                </button>
              )}
              {nextAction.action === "complete" && (
                <button
                  type="button"
                  className="btn btn-primary couple-home__big-btn"
                  disabled={busy}
                  onClick={() => void handleFinishSetup()}
                >
                  {busy ? nextAction.busyLabel : nextAction.label}
                </button>
              )}
            </div>
          )}

          {setupStatus && (
            <div className="couple-home__status-banner">
              <AlbumStatusBanner
                status={{
                  photo_count: setupStatus.photo_count,
                  pending_count: setupStatus.unindexed_count,
                  failed_count: setupStatus.failed_count ?? 0,
                  indexing_in_progress: setupStatus.indexing_in_progress ?? false,
                  gallery_search_ready: setupStatus.gallery_search_ready ?? false,
                }}
                uploadActive={false}
                indexing={busy}
                indexProgress={indexProgress}
              />
            </div>
          )}
        </section>

        {/* PERSONALIZE: branding section (collapsible) */}
        <section className="couple-home__section">
          <header className="couple-home__section-head">
            <h3>{tPath("coupleHome.brandingSummary")}</h3>
            {!showBrandingForm && (
              <button
                type="button"
                className="couple-home__section-toggle"
                onClick={() => setShowBrandingForm(true)}
              >
                {progress.branding ? tPath("coupleHome.brandingSavedTap") : tPath("coupleHome.brandingEdit")}
              </button>
            )}
          </header>

          {showBrandingForm ? (
            <form className="event-setup__form" onSubmit={handleBrandingSubmit}>
              <label htmlFor="setup-title">{tPath("eventTitleLabel")}</label>
              <input
                id="setup-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <label htmlFor="setup-couple">{tPath("coupleNamesLabel")}</label>
              <input
                id="setup-couple"
                value={coupleNames}
                onChange={(e) => setCoupleNames(e.target.value)}
                placeholder={tPath("coupleNamesPlaceholder")}
              />

              <label htmlFor="setup-date">{tPath("weddingDateLabel")}</label>
              <input
                id="setup-date"
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
              />

              <label htmlFor="setup-accent">{tPath("accentLabel")}</label>
              <div className="event-setup__color-row">
                <input
                  id="setup-accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                />
                <span>{tPath("accentHint")}</span>
              </div>

              <label htmlFor="setup-welcome">{tBranding("welcomeMessageLabel")}</label>
              <textarea
                id="setup-welcome"
                className="event-setup__textarea"
                rows={3}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder={tBranding("welcomeMessagePlaceholder")}
              />
              <p className="event-setup__field-hint">{tBranding("welcomeMessageHint")}</p>

              <label>{tBranding("decorationLabel")}</label>
              <DecorationThemePicker
                value={decorationTheme}
                onChange={setDecorationTheme}
                accentColor={accentColor}
                name="setup-decoration"
              />

              <div className="event-setup__actions">
                {progress.branding && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowBrandingForm(false)}
                  >
                    {tPath("coupleHome.brandingCancel")}
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? tPath("saving") : tPath("saveContinue")}
                </button>
              </div>
            </form>
          ) : (
            <p className="couple-home__section-summary">
              {[displayNames, weddingDate].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>

        {/* CO-ADMIN INVITE: collapsible */}
        <section className="couple-home__section">
          <header className="couple-home__section-head">
            <h3>{tPath("coupleHome.coadminTitle")}</h3>
            <button
              type="button"
              className="couple-home__section-toggle"
              onClick={() => setShowCoadmin((v) => !v)}
              aria-expanded={showCoadmin}
            >
              {showCoadmin ? tPath("coupleHome.brandingCancel") : tPath("invitePartnerBtn")}
            </button>
          </header>

          {showCoadmin && (
            <>
              <p className="couple-home__section-lead">{tPath("coupleHome.coadminLead")}</p>
              <form className="event-setup__form" onSubmit={handleInviteSubmit}>
                <label htmlFor="setup-invite">{tPath("partnerEmailLabel")}</label>
                <input
                  id="setup-invite"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={tPath("partnerEmailPlaceholder")}
                />
                {inviteSent && <p className="event-setup__success">{tPath("inviteSent")}</p>}
                <div className="event-setup__actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !inviteEmail.trim()}
                  >
                    {busy ? tPath("sending") : tPath("sendInvite")}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* SHARE: surfaced once the gallery is live (full UI lives in ShareSheet) */}
        {progress.live && guestUrl && (
          <section className="couple-home__section couple-home__share">
            <header className="couple-home__section-head">
              <h3>{tPath("coupleHome.shareTitle")}</h3>
            </header>
            <p className="couple-home__section-lead">{tPath("coupleHome.shareLead")}</p>
            <button
              type="button"
              className="btn btn-primary couple-home__big-btn"
              onClick={() => setShowShare(true)}
            >
              {tPath("coupleHome.openShare")}
            </button>
          </section>
        )}

        {error && <p className="error-banner">{error}</p>}
        {notice && !error && <p className="event-setup__notice">{notice}</p>}

        <p className="event-setup__footer">
          <Link to={`/e/${slug}/manage?from=setup`}>{tPath("coupleHome.viewFullDashboard")}</Link>
        </p>
      </div>

        {progress.live && guestUrl && (
          <button
            type="button"
            className="couple-home__share-fab"
            onClick={() => {
              setShowShare(true);
              track("couple_home_share_opened", { source: "fab" });
            }}
            aria-label={tPath("coupleHome.openShare")}
          >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4" />
            <path d="m15.4 6.5-6.8 4" />
          </svg>
        </button>
      )}

      {overlays}
    </div>
  );
}

function buildHelpTopics(
  tHelp: (key: string) => string,
  actions: { openPreview: () => void; openCoadmin: () => void; goToAlbum: () => void },
): HelpTopic[] {
  return [
    {
      id: "guestFlow",
      title: tHelp("topics.guestFlow.title"),
      body: tHelp("topics.guestFlow.body"),
      actionLabel: tHelp("topics.preview.action"),
      onAction: actions.openPreview,
    },
    {
      id: "upload",
      title: tHelp("topics.upload.title"),
      body: tHelp("topics.upload.body"),
      actionLabel: tHelp("topics.upload.action"),
      onAction: actions.goToAlbum,
    },
    {
      id: "partner",
      title: tHelp("topics.partner.title"),
      body: tHelp("topics.partner.body"),
      actionLabel: tHelp("topics.partner.action"),
      onAction: actions.openCoadmin,
    },
    {
      id: "indexing",
      title: tHelp("topics.indexing.title"),
      body: tHelp("topics.indexing.body"),
    },
    {
      id: "preview",
      title: tHelp("topics.preview.title"),
      body: tHelp("topics.preview.body"),
      actionLabel: tHelp("topics.preview.action"),
      onAction: actions.openPreview,
    },
    {
      id: "support",
      title: tHelp("topics.support.title"),
      body: tHelp("topics.support.body"),
    },
  ];
}
