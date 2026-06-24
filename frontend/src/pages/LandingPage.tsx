import { Navigate, useSearchParams } from "react-router-dom";
import { InstallPrompt } from "../components/InstallPrompt";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import "../styles/Landing.scss";

export function LandingPage() {
  const { tPath } = useTranslation("landing");
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
        <p className="landing__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="landing__lead">{tPath("lead")}</p>
        {session ? (
          <p className="landing__hint">{tPath("hintSignedIn")}</p>
        ) : (
          <p className="landing__hint">{tPath("hintSignedOut")}</p>
        )}
      </header>
    </div>
  );
}
