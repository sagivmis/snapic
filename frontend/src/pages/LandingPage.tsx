import { Link, Navigate, useSearchParams } from "react-router-dom";
import { InstallPrompt } from "../components/InstallPrompt";
import { useAuth } from "../auth/AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";
import "../styles/Landing.scss";

export function LandingPage() {
  const { session, isSuperAdmin, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const legacyShare = searchParams.get("share");
  if (legacyShare) {
    return <Navigate to={`/share/${legacyShare}`} replace />;
  }

  return (
    <div className="landing">
      <InstallPrompt />
      <header className="landing__hero">
        <p className="landing__eyebrow">Snapic</p>
        <h1>Find yourself in every wedding photo</h1>
        <p className="landing__lead">
          Upload a selfie and search the wedding gallery for photos that include you — no scrolling
          through hundreds of shots.
        </p>
        <div className="landing__actions">
          <Link className="btn btn-primary" to="/demo">
            Try demo
          </Link>
          {isSupabaseConfigured && (
            <Link className="btn btn-secondary" to="/request-access">
              Request event access
            </Link>
          )}
        </div>
      </header>

      <section className="landing__links">
        {session ? (
          <div className="landing__signed-in">
            <span>Signed in as {session.user.email}</span>
            {isSuperAdmin && (
              <Link to="/admin" className="landing__admin-link">
                Admin dashboard
              </Link>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : isSupabaseConfigured ? (
          <Link to="/login">Sign in to save your results</Link>
        ) : null}
      </section>
    </div>
  );
}
