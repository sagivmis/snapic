import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/AuthPages.scss";

function defaultPathForRole(globalRole: string | undefined): string {
  if (globalRole === "super_admin") {
    return "/admin";
  }
  if (globalRole === "photographer") {
    return "/studio";
  }
  return "/";
}

export function LoginPage() {
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
        <h1>Sign in</h1>
        <p>Authentication is not configured for this deployment.</p>
        <Link to="/">Back home</Link>
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
      setError(err instanceof Error ? err.message : "Could not send magic link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <p className="auth-page__lead">Use Google or a magic link sent to your email.</p>

      <button
        type="button"
        className="btn btn-primary auth-page__google"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signInWithGoogle(from).catch((err) => {
            setError(err instanceof Error ? err.message : "Google sign-in failed");
            setBusy(false);
          });
        }}
      >
        Continue with Google
      </button>

      <div className="auth-page__divider">or</div>

      {sent ? (
        <p className="auth-page__success">Check your email for a sign-in link.</p>
      ) : (
        <form className="auth-page__form" onSubmit={handleMagicLink}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Send magic link
          </button>
        </form>
      )}

      {error && <p className="error-banner">{error}</p>}
      <Link className="auth-page__back" to="/">
        Back home
      </Link>
    </div>
  );
}
