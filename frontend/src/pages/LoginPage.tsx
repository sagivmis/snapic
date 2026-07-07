import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { SiteFooter } from "../components/layout/SiteFooter";
import { useAuth } from "../auth/AuthProvider";
import { usePostLoginRoute } from "../hooks/usePostLoginRoute";
import { useTranslation } from "../i18n";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/AuthPages.scss";

export function LoginPage() {
  const { t, tPath } = useTranslation("auth");
  const { signInWithGoogle, signInWithMagicLink, session, loading } = useAuth();
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
  const destination = usePostLoginRoute();

  useEffect(() => {
    if (loading || !session) {
      return;
    }
    // Honor explicit ?next= or location state first; fall back to the smart router
    // once memberships have loaded so we can route couples/photographers correctly.
    if (from !== "/") {
      navigate(from, { replace: true });
      return;
    }
    if (destination.loaded) {
      navigate(destination.path, { replace: true });
    }
  }, [loading, session, navigate, from, destination.loaded, destination.path]);

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
      <SiteFooter variant="inline" />
    </div>
  );
}
