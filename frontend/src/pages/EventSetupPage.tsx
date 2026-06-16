import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchEventBySlug,
  fetchEventSetupStatus,
  inviteEventMember,
  updateEvent,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import type { EventPublic, EventSetupStatus } from "../types";
import "../styles/EventSetup.scss";

type SetupStep = "welcome" | "branding" | "invite" | "ready";

const STEPS: SetupStep[] = ["welcome", "branding", "invite", "ready"];

const STEP_LABELS: Record<SetupStep, string> = {
  welcome: "Welcome",
  branding: "Branding",
  invite: "Partner",
  ready: "Go live",
};

export function EventSetupPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { session, getAccessToken, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [setupStatus, setSetupStatus] = useState<EventSetupStatus | null>(null);
  const [step, setStep] = useState<SetupStep>("welcome");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const [title, setTitle] = useState("");
  const [coupleNames, setCoupleNames] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [accentColor, setAccentColor] = useState("#c9a962");
  const [inviteEmail, setInviteEmail] = useState("");

  const stepIndex = STEPS.indexOf(step);

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

  const load = useCallback(async () => {
    if (!slug || !session) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const ev = await fetchEventBySlug(slug, token);
      setEvent(ev);
      setTitle(ev.title);
      setWeddingDate(ev.wedding_date ?? "");
      const eventBranding = ev.branding ?? {};
      setCoupleNames(typeof eventBranding.couple_names === "string" ? eventBranding.couple_names : "");
      setAccentColor(typeof eventBranding.accent_color === "string" ? eventBranding.accent_color : "#c9a962");

      if (ev.onboarding_completed_at) {
        navigate(`/e/${slug}/manage`, { replace: true });
        return;
      }

      let hasMembership = isSuperAdmin;
      if (supabase && !hasMembership) {
        const { data: membership } = await supabase
          .from("event_members")
          .select("role")
          .eq("event_id", ev.id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        hasMembership = Boolean(membership);
      }
      setIsAdmin(hasMembership);
      if (!hasMembership) {
        setError("You do not have permission to set up this event.");
        return;
      }

      setSetupStatus(await fetchEventSetupStatus(ev.id, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event");
    } finally {
      setLoading(false);
    }
  }, [slug, session, getAccessToken, isSuperAdmin, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (step === "ready") {
      void refreshSetupStatus();
    }
  }, [step, refreshSetupStatus]);

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
        throw new Error("Not signed in");
      }
      const updated = await updateEvent(
        event.id,
        {
          title,
          wedding_date: weddingDate || null,
          branding: {
            couple_names: coupleNames,
            accent_color: accentColor,
          },
        },
        token,
      );
      setEvent(updated);
      await refreshSetupStatus();
      setStep("invite");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save branding");
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
        throw new Error("Not signed in");
      }
      await inviteEventMember(event.id, inviteEmail.trim(), token);
      setInviteEmail("");
      setInviteSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite");
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
        throw new Error("Not signed in");
      }
      await updateEvent(event.id, { complete_onboarding: true }, token);
      navigate(`/e/${slug}/manage`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup");
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
          <h1>Event setup</h1>
          <p>{error ?? "This event could not be loaded."}</p>
          <Link to="/" className="btn btn-secondary">
            Back home
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
            <p className="event-setup__eyebrow">Snapic setup</p>
            {isSuperAdmin && (
              <Link className="event-setup__admin-link" to="/admin">
                Admin dashboard
              </Link>
            )}
          </div>
          <h1>{displayNames}</h1>
          <div className="event-setup__progress" aria-hidden="true">
            {STEPS.map((item, index) => (
              <span
                key={item}
                className={`event-setup__progress-dot${
                  index <= stepIndex ? " event-setup__progress-dot--active" : ""
                }`}
              />
            ))}
          </div>
          <p className="event-setup__step-label">
            Step {stepIndex + 1} of {STEPS.length} · {STEP_LABELS[step]}
          </p>
        </header>

        <div className="event-setup__card">
          {step === "welcome" && (
            <section className="event-setup__section">
              <h2>Welcome to your wedding gallery</h2>
              <p className="event-setup__lead">
                We&apos;ll walk you through branding your guest page, inviting your partner, and
                getting ready to share your album.
              </p>
              <ul className="event-setup__bullets">
                <li>Personalize how guests see your event</li>
                <li>Optionally invite your partner as co-admin</li>
                <li>Upload photos and go live when you&apos;re ready</li>
              </ul>
              <button type="button" className="btn btn-primary" onClick={() => setStep("branding")}>
                Get started
              </button>
            </section>
          )}

          {step === "branding" && (
            <section className="event-setup__section">
              <h2>Make it yours</h2>
              <p className="event-setup__lead">
                These details appear on your guest page and printable QR cards.
              </p>
              <form className="event-setup__form" onSubmit={handleBrandingSubmit}>
                <label htmlFor="setup-title">Event title</label>
                <input
                  id="setup-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <label htmlFor="setup-couple">Couple names</label>
                <input
                  id="setup-couple"
                  value={coupleNames}
                  onChange={(e) => setCoupleNames(e.target.value)}
                  placeholder="Alex & Jordan"
                />

                <label htmlFor="setup-date">Wedding date</label>
                <input
                  id="setup-date"
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />

                <label htmlFor="setup-accent">Accent color</label>
                <div className="event-setup__color-row">
                  <input
                    id="setup-accent"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                  <span>Used on buttons, links, and guest page accents</span>
                </div>

                <div className="event-setup__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep("welcome")}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? "Saving…" : "Save & continue"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === "invite" && (
            <section className="event-setup__section">
              <h2>Invite your partner</h2>
              <p className="event-setup__lead">
                Optional — send a co-admin invite so they can upload photos and manage settings
                too.
              </p>
              <form className="event-setup__form" onSubmit={handleInviteSubmit}>
                <label htmlFor="setup-invite">Partner email</label>
                <input
                  id="setup-invite"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="partner@example.com"
                />
                {inviteSent && (
                  <p className="event-setup__success">Invite sent — they&apos;ll get an email to join.</p>
                )}
                <div className="event-setup__actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep("branding")}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep("ready")}
                  >
                    Skip for now
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !inviteEmail.trim()}
                  >
                    {busy ? "Sending…" : "Send invite"}
                  </button>
                </div>
              </form>
              {inviteSent && (
                <button type="button" className="btn btn-primary event-setup__continue" onClick={() => setStep("ready")}>
                  Continue
                </button>
              )}
            </section>
          )}

          {step === "ready" && setupStatus && (
            <section className="event-setup__section">
              <h2>Almost there</h2>
              <p className="event-setup__lead">
                Upload your wedding photos from the manage dashboard, index faces, then set your
                event to Active when you&apos;re ready for guests.
              </p>

              <ul className="event-setup__checklist">
                <li className={setupStatus.branding_ok ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  Branding saved
                </li>
                <li className={setupStatus.has_photos ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {setupStatus.has_photos
                    ? `${setupStatus.photo_count} photo${setupStatus.photo_count === 1 ? "" : "s"} uploaded`
                    : "Upload wedding photos"}
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
                    ? "Faces indexed for matching"
                    : setupStatus.has_photos
                      ? `Index faces (${setupStatus.unindexed_count} remaining)`
                      : "Index faces after upload"}
                </li>
                <li className={setupStatus.is_active ? "event-setup__checklist-item--done" : ""}>
                  <span className="event-setup__checkmark" aria-hidden="true" />
                  {setupStatus.is_active ? "Event is live for guests" : "Set event to Active when ready"}
                </li>
              </ul>

              <div className="event-setup__actions event-setup__actions--stack">
                <Link to={`/e/${slug}/manage`} className="btn btn-secondary">
                  Open album dashboard
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void handleFinishSetup()}
                >
                  {busy ? "Finishing…" : "Finish setup"}
                </button>
              </div>
              <p className="event-setup__hint">
                You can return anytime from your manage dashboard to upload photos or go live.
              </p>
            </section>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <p className="event-setup__footer">
          <Link to={`/e/${slug}/manage`}>Skip to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
