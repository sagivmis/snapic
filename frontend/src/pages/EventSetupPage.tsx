import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchEventBySlug,
  fetchEventSetupStatus,
  inviteEventMember,
  reindexEventGallery,
  updateEvent,
} from "../api/client";
import { IndexFacesProgress } from "../components/IndexFacesProgress";
import { AlbumStatusBanner } from "../components/AlbumStatusBanner";
import { useAuth } from "../auth/AuthProvider";
import type { EventPublic, EventSetupStatus } from "../types";
import type { IndexStreamEvent } from "../api/client";
import { useTranslation } from "../i18n";
import { formatIndexResult } from "../utils/galleryFaceIndex";
import { getNextSetupAction, parseSetupStep, SETUP_STEPS, type SetupStep } from "../utils/onboarding";
import { canManageEvent } from "../utils/eventAccess";
import "../styles/EventSetup.scss";

function buildBrandingPatch(
  event: EventPublic,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(event.branding ?? {}), ...patch };
}

export function EventSetupPage() {
  const { t, tPath } = useTranslation("events.setup");
  const { tPath: tManage } = useTranslation("events.manage");
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { session, getAccessToken, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [setupStatus, setSetupStatus] = useState<EventSetupStatus | null>(null);
  const [step, setStep] = useState<SetupStep>("welcome");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [indexProgress, setIndexProgress] = useState<Extract<
    IndexStreamEvent,
    { type: "progress" }
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const [title, setTitle] = useState("");
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [accentColor, setAccentColor] = useState("#c9a962");
  const [inviteEmail, setInviteEmail] = useState("");

  const stepLabels: Record<SetupStep, string> = {
    welcome: tPath("steps.welcome"),
    branding: tPath("steps.branding"),
    invite: tPath("steps.invite"),
    ready: tPath("steps.ready"),
  };
  const stepIndex = SETUP_STEPS.indexOf(step);
  const manageHref = `/e/${slug}/manage?from=setup`;
  const uploadHref = `${manageHref}&tab=album`;
  const nextAction = useMemo(
    () => (setupStatus ? getNextSetupAction(setupStatus) : null),
    [setupStatus],
  );

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

  const persistSetupStep = useCallback(
    async (nextStep: SetupStep, eventRow: EventPublic = event!) => {
      if (!eventRow) {
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const updated = await updateEvent(
        eventRow.id,
        {
          branding: buildBrandingPatch(eventRow, { onboarding_step: nextStep }),
        },
        token,
      );
      setEvent(updated);
    },
    [event, getAccessToken],
  );

  const goToStep = useCallback(
    (nextStep: SetupStep) => {
      setStep(nextStep);
      void persistSetupStep(nextStep);
    },
    [persistSetupStep],
  );

  const load = useCallback(async () => {
    if (!slug || !session) {
      return;
    }
    setLoading(true);
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
      const eventBranding = ev.branding ?? {};
      setCoupleNames(typeof eventBranding.couple_names === "string" ? eventBranding.couple_names : "");
      setAccentColor(typeof eventBranding.accent_color === "string" ? eventBranding.accent_color : "#c9a962");

      const savedStep = parseSetupStep(eventBranding.onboarding_step);
      if (savedStep) {
        setStep(savedStep);
      }

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

      setSetupStatus(await fetchEventSetupStatus(ev.id, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [slug, session, getAccessToken, isSuperAdmin, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (step !== "ready") {
      return;
    }
    void refreshSetupStatus();
  }, [step, refreshSetupStatus]);

  useEffect(() => {
    if (step !== "ready") {
      return;
    }

    function handleReturn() {
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
  }, [step, refreshSetupStatus]);

  useEffect(() => {
    if (step !== "ready" || !event) {
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
  }, [step, event, setupStatus, busy, refreshSetupStatus]);

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
            onboarding_step: "ready",
          }),
        },
        token,
      );
      setEvent(updated);
      setStep("ready");
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
      const result = await reindexEventGallery(event.id, token, (progress) => {
        setIndexProgress(progress);
      });
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

  if (loading) {
    return (
      <div className="event-setup event-setup--loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!event || !isAdmin) {
    return (
      <div className="event-setup">
        <div className="event-setup__card">
          <h1>{tPath("title")}</h1>
          <p>{error ?? tPath("loadFailed")}</p>
          <Link to="/" className="btn btn-secondary">
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const displayNames = coupleNames || title;

  return (
    <div
      className="event-setup"
      style={{ "--event-accent": accentColor } as CSSProperties}
    >
      <div className="event-setup__shell">
        <header className="event-setup__header">
          <div className="event-setup__header-top">
            <p className="event-setup__eyebrow">{tPath("eyebrow")}</p>
            {isSuperAdmin && (
              <Link className="event-setup__admin-link" to="/admin">
                {tManage("adminDashboard")}
              </Link>
            )}
          </div>
          <h1>{displayNames}</h1>
          <div className="event-setup__progress" aria-hidden="true">
            {SETUP_STEPS.map((item, index) => (
              <span
                key={item}
                className={`event-setup__progress-dot${
                  index <= stepIndex ? " event-setup__progress-dot--active" : ""
                }`}
              />
            ))}
          </div>
          <p className="event-setup__step-label">
            {tPath("stepLabel", {
              current: stepIndex + 1,
              total: SETUP_STEPS.length,
              stepName: stepLabels[step],
            })}
          </p>
        </header>

        <div className="event-setup__card">
          {step === "welcome" && (
            <section className="event-setup__section">
              <h2>{tPath("welcomeTitle")}</h2>
              <p className="event-setup__lead">
                {event.photographer_led ? tPath("welcomeLeadPhotographer") : tPath("welcomeLeadSelf")}
              </p>
              <ul className="event-setup__bullets">
                <li>{tPath("bulletPersonalize")}</li>
                <li>{tPath("bulletInvitePartner")}</li>
                {!event.photographer_led && <li>{tPath("bulletUploadSelf")}</li>}
                {event.photographer_led && <li>{tPath("bulletReviewPhotographer")}</li>}
              </ul>
              <button type="button" className="btn btn-primary" onClick={() => goToStep("branding")}>
                {tPath("getStarted")}
              </button>
            </section>
          )}

          {step === "branding" && (
            <section className="event-setup__section">
              <h2>{tPath("brandingTitle")}</h2>
              <p className="event-setup__lead">{tPath("brandingLead")}</p>
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

                <div className="event-setup__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => goToStep("welcome")}>
                    {t("back")}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? tPath("saving") : tPath("saveContinue")}
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === "invite" && (
            <section className="event-setup__section">
              <h2>{tPath("inviteTitle")}</h2>
              <p className="event-setup__lead">{tPath("inviteLead")}</p>
              <form className="event-setup__form" onSubmit={handleInviteSubmit}>
                <label htmlFor="setup-invite">{tPath("partnerEmailLabel")}</label>
                <input
                  id="setup-invite"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={tPath("partnerEmailPlaceholder")}
                />
                {inviteSent && (
                  <p className="event-setup__success">{tPath("inviteSent")}</p>
                )}
                <div className="event-setup__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => goToStep("branding")}>
                    {t("back")}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => goToStep("ready")}>
                    {tPath("skipForNow")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !inviteEmail.trim()}
                  >
                    {busy ? tPath("sending") : tPath("sendInvite")}
                  </button>
                </div>
              </form>
              {inviteSent && (
                <button
                  type="button"
                  className="btn btn-primary event-setup__continue"
                  onClick={() => goToStep("ready")}
                >
                  {t("continue")}
                </button>
              )}
            </section>
          )}

          {step === "ready" && setupStatus && (
            <section className="event-setup__section">
              <h2>{tPath("readyTitle")}</h2>
              <p className="event-setup__lead">{tPath("readyLead")}</p>

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

              <ul className="event-setup__checklist">
                <li className={setupStatus.branding_ok ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {tPath("checklistBranding")}
                </li>
                <li className={setupStatus.has_photos ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {setupStatus.has_photos
                    ? tPath(
                        setupStatus.photo_count === 1 ? "checklistPhotos_one" : "checklistPhotos_other",
                        { count: setupStatus.photo_count },
                      )
                    : tPath("checklistUpload")}
                </li>
                <li
                  className={
                    setupStatus.has_photos && setupStatus.faces_indexed
                      ? "event-setup__checklist-item--done"
                      : ""
                  }
                >
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {setupStatus.faces_indexed
                    ? setupStatus.failed_count > 0
                      ? tPath("checklistIndexedFailed", { count: setupStatus.failed_count })
                      : tPath("checklistIndexed")
                    : setupStatus.indexing_in_progress
                      ? tPath("checklistIndexing")
                      : setupStatus.has_photos
                        ? tPath("checklistIndexRemaining", { count: setupStatus.unindexed_count })
                        : tPath("checklistIndexAfterUpload")}
                </li>
                <li className={setupStatus.is_active ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {setupStatus.is_active ? tPath("checklistLive") : tPath("checklistActivate")}
                </li>
              </ul>

              {nextAction && (
                <div className="event-setup__actions event-setup__actions--stack">
                  {nextAction.action === "upload" && (
                    <Link to={uploadHref} className="btn btn-primary">
                      {nextAction.label}
                    </Link>
                  )}
                  {nextAction.action === "index" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
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
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void handleGoLive()}
                    >
                      {busy ? nextAction.busyLabel : nextAction.label}
                    </button>
                  )}
                  {nextAction.action === "complete" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void handleFinishSetup()}
                    >
                      {busy ? nextAction.busyLabel : nextAction.label}
                    </button>
                  )}
                  {nextAction.action !== "complete" && (
                    <button type="button" className="btn btn-ghost" onClick={() => goToStep("invite")}>
                      {tPath("invitePartnerBtn")}
                    </button>
                  )}
                </div>
              )}
              <p className="event-setup__hint">
                {nextAction?.action === "complete"
                  ? tPath("readyHintComplete")
                  : tPath("readyHintProgress")}
              </p>
            </section>
          )}

          {error && <p className="error-banner">{error}</p>}
          {notice && !error && <p className="event-setup__notice">{notice}</p>}
        </div>

        <p className="event-setup__footer">
          <Link to={manageHref}>{tPath("skipToDashboard")}</Link>
        </p>
      </div>
    </div>
  );
}
