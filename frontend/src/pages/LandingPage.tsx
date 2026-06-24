import { Navigate, useSearchParams } from "react-router-dom";
import { InstallPrompt } from "../components/InstallPrompt";
import { useAuth } from "../auth/AuthProvider";
import "../styles/Landing.scss";

export function LandingPage() {
  const { session } = useAuth();
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
          Guests upload a selfie and instantly find every wedding photo they appear in — no scrolling
          through hundreds of shots.
        </p>
        {session ? (
          <p className="landing__hint">Pick a destination from the sidebar — studio, events, or admin.</p>
        ) : (
          <p className="landing__hint">
            Try the demo, request a gallery, or explore Snapic Studio for photographers.
          </p>
        )}
      </header>
    </div>
  );
}
