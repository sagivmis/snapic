import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/AuthPages.scss";

function defaultPathForRole(globalRole: string | undefined): string {
  if (globalRole === "super_admin") {
    return "/admin";
  }
  if (globalRole === "photographer") {
    return "/studio/select";
  }
  return "/";
}

export function LoginPage() {
  const { t, tPath } = useTranslation("auth");
  const { signInWithGoogle, signInWithMagicLink, session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextFromQuery = new URLSearchParams(location.search).get("next");
  const from =
    (nextFromQuery && nextFromQuery.startsWith("/") ? nextFromQuery : null) ??
    (location.state as { from?: string } | null)?.from ??
    "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      const fallback = defaultPathForRole(profile?.global_role);
      const destination = from === "/" ? fallback : from;
      navigate(destination, { replace: true });
    }
  }, [loading, session, navigate, from, profile?.global_role]);

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-page__language">
          <LanguageSwitcher />
        </div>
        <h1>{tPath("loginTitle")}</h1>
        <p>{tPath("supabaseNotConfigured")}</p>
        <Link to="/">{t("backHome")}</Link>
      </div>
    );
  }

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithMagicLink(email.trim(), from);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("magicLinkFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__language">
        <LanguageSwitcher />
      </div>
      <h1>{tPath("loginTitle")}</h1>
      <p className="auth-page__lead">{tPath("loginLead")}</p>

      <button
        type="button"
        className="btn btn-primary auth-page__google"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signInWithGoogle(from).catch((err) => {
            setError(err instanceof Error ? err.message : tPath("googleSignInFailed"));
            setBusy(false);
          });
        }}
      >
        {tPath("continueGoogle")}
      </button>

      <div className="auth-page__divider">{tPath("orEmail")}</div>

      {sent ? (
        <p className="auth-page__success">{tPath("magicLinkSent")}</p>
      ) : (
        <form className="auth-page__form" onSubmit={handleMagicLink}>
          <label htmlFor="email">{tPath("emailLabel")}</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tPath("emailPlaceholder")}
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            {tPath("sendMagicLink")}
          </button>
        </form>
      )}

      {error && <p className="error-banner">{error}</p>}
      <Link className="auth-page__back" to="/">
        {t("backHome")}
      </Link>
    </div>
  );
}
