import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { InstallPrompt } from "../components/InstallPrompt";
import { useAuth } from "../auth/AuthProvider";
import { usePostLoginRoute, type PostLoginDestinationKind } from "../hooks/usePostLoginRoute";
import { useTranslation } from "../i18n";
import { isSupabaseConfigured } from "../lib/supabase";
import { track } from "../lib/analytics";
import "../styles/Landing.scss";

function extractEventSlug(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const maybeUrl = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const match = maybeUrl.pathname.match(/\/e\/([^/]+)/);
    if (match) {
      return match[1];
    }
  } catch {
    /* not a URL, fall through */
  }
  const cleaned = trimmed.replace(/^\/+|\/+$/g, "").replace(/^e\//, "");
  return cleaned.split("/")[0];
}

function continueLabelKey(kind: PostLoginDestinationKind): string {
  switch (kind) {
    case "admin":
      return "continueAdmin";
    case "couple-onboarding":
      return "continueCoupleOnboarding";
    case "couple-home":
      return "continueCoupleHome";
    case "studio":
      return "continueStudio";
    case "studio-select":
      return "continueStudioSelect";
    default:
      return "continueCoupleHome";
  }
}

export function LandingPage() {
  const { t: tCommon } = useTranslation("common");
  const { tPath } = useTranslation("landing");
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [guestExpanded, setGuestExpanded] = useState(false);
  const [eventInput, setEventInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const destination = usePostLoginRoute();

  const legacyShare = searchParams.get("share");
  if (legacyShare) {
    return <Navigate to={`/share/${legacyShare}`} replace />;
  }

  function handleGuestSubmit(event: FormEvent) {
    event.preventDefault();
    const slug = extractEventSlug(eventInput);
    if (!slug) {
      setInputError(tPath("chooser.guest.placeholder"));
      return;
    }
    setInputError(null);
    track("landing_chooser_clicked", { choice: "guest", slug });
    navigate(`/e/${slug}`);
  }

  if (session) {
    const ctaKey = continueLabelKey(destination.kind);
    return (
      <div className="landing">
        <InstallPrompt />
        <header className="landing__hero">
          <p className="landing__eyebrow">{tPath("eyebrow")}</p>
          <h1>{tPath("title")}</h1>
          <p className="landing__lead">{tPath("lead")}</p>
        </header>

        <section className="landing__signed-in-card">
          <p className="landing__signed-in-greeting">
            {tPath("signedIn.greeting")}
            {profile?.full_name ? `, ${profile.full_name}` : ""}
          </p>
          <Link
            to={destination.path}
            className="btn btn-primary landing__primary-cta"
            onClick={() => track("landing_continue_clicked", { kind: destination.kind })}
          >
            {tPath(`signedIn.${ctaKey}`)}
          </Link>
          <p className="landing__signed-in-hint">{tPath("signedIn.secondaryHint")}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="landing">
      <InstallPrompt />
      <header className="landing__hero">
        <p className="landing__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="landing__lead">{tPath("lead")}</p>
      </header>

      <section
        className="landing__chooser"
        aria-label={tPath("chooser.title")}
      >
        <h2 className="landing__chooser-title">{tPath("chooser.title")}</h2>

        <div className="landing__chooser-grid">
          <article
            className={`landing__choice landing__choice--guest${
              guestExpanded ? " landing__choice--open" : ""
            }`}
          >
            <div className="landing__choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </div>
            <h3>{tPath("chooser.guest.title")}</h3>
            <p>{tPath("chooser.guest.lead")}</p>
            {guestExpanded ? (
              <form className="landing__guest-form" onSubmit={handleGuestSubmit}>
                <label htmlFor="landing-event-input" className="sr-only">
                  {tPath("chooser.guest.placeholder")}
                </label>
                <input
                  id="landing-event-input"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoFocus
                  placeholder={tPath("chooser.guest.placeholder")}
                  value={eventInput}
                  onChange={(e) => setEventInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  {tPath("chooser.guest.openLink")}
                </button>
                {inputError && (
                  <p className="landing__choice-error">{inputError}</p>
                )}
                <Link to="/demo" className="landing__choice-secondary">
                  {tPath("chooser.guest.tryDemo")}
                </Link>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setGuestExpanded(true);
                  track("landing_chooser_clicked", { choice: "guest", expanded: true });
                }}
              >
                {tPath("chooser.guest.cta")}
              </button>
            )}
          </article>

          <article className="landing__choice landing__choice--couple">
            <div className="landing__choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8.05-2.7L12 9.4l-1.05-1.1A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />
              </svg>
            </div>
            <h3>{tPath("chooser.couple.title")}</h3>
            <p>{tPath("chooser.couple.lead")}</p>
            <Link
              to="/request-access"
              className="btn btn-primary"
              onClick={() => track("landing_chooser_clicked", { choice: "couple" })}
            >
              {tPath("chooser.couple.cta")}
            </Link>
          </article>

          <article className="landing__choice landing__choice--photographer">
            <div className="landing__choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <h3>{tPath("chooser.photographer.title")}</h3>
            <p>{tPath("chooser.photographer.lead")}</p>
            <Link
              to="/for-photographers"
              className="btn btn-primary"
              onClick={() => track("landing_chooser_clicked", { choice: "photographer" })}
            >
              {tPath("chooser.photographer.cta")}
            </Link>
          </article>
        </div>

        {isSupabaseConfigured && (
          <p className="landing__chooser-foot">
            <Link to="/login" className="landing__signin-link">
              {tCommon("signIn")}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
