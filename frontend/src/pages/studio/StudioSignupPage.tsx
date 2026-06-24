import { FormEvent, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkStudioSlug, studioSignup } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { setStoredStudioOrgId } from "../../lib/studioOrg";
import {
  SlugAvailabilityInput,
  type SlugCheckStatus,
} from "../../components/SlugAvailabilityInput";
import { useTranslation } from "../../i18n";
import "../../styles/AuthPages.scss";
import "../../styles/SlugAvailabilityInput.scss";

export function StudioSignupPage() {
  const navigate = useNavigate();
  const { getAccessToken, session, signInWithGoogle } = useAuth();
  const { t, tPath } = useTranslation("studio.signup");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugCheckStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCheckSlug = useCallback(
    async (value: string) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      return checkStudioSlug(value, token);
    },
    [getAccessToken, t],
  );

  const slugBlocksSubmit =
    slug.trim().length > 0 &&
    (slugStatus === "pending" || slugStatus === "checking" || slugStatus === "taken" || slugStatus === "too_short");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (slugBlocksSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("signInFirst"));
      }
      const result = await studioSignup(name.trim(), slug.trim(), token);
      setStoredStudioOrgId(result.organization.id);
      navigate("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signupFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="auth-page">
        <p className="auth-page__eyebrow">{tPath("eyebrow")}</p>
        <h1>{tPath("title")}</h1>
        <p className="auth-page__lead">{tPath("leadSignedOut")}</p>
        <button
          type="button"
          className="btn btn-primary auth-page__google"
          onClick={() => void signInWithGoogle("/studio/signup")}
        >
          {t("continueGoogle")}
        </button>
        <Link className="auth-page__back" to="/for-photographers">
          {tPath("backToPhotographers")}
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <p className="auth-page__eyebrow">{tPath("eyebrow")}</p>
      <h1>{tPath("title")}</h1>
      <p className="auth-page__lead">{tPath("leadSignedIn")}</p>
      <form className="auth-page__form auth-page__form--wide" onSubmit={handleSubmit}>
        <label htmlFor="name">{tPath("studioNameLabel")}</label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tPath("studioNamePlaceholder")}
          autoComplete="organization"
        />
        <label htmlFor="slug">{tPath("slugLabel")}</label>
        <SlugAvailabilityInput
          id="slug"
          value={slug}
          onChange={setSlug}
          onCheckSlug={handleCheckSlug}
          onStatusChange={setSlugStatus}
          disabled={busy}
          placeholder={tPath("slugPlaceholder")}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || slugBlocksSubmit}>
          {busy ? tPath("creating") : tPath("createBtn")}
        </button>
      </form>
      {error && <p className="error-banner">{error}</p>}
      <Link className="auth-page__back" to="/">
        {tPath("backHome")}
      </Link>
    </div>
  );
}
