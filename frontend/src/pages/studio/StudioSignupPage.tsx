import { FormEvent, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkStudioSlug, studioSignup } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import {
  SlugAvailabilityInput,
  type SlugCheckStatus,
} from "../../components/SlugAvailabilityInput";
import "../../styles/AuthPages.scss";
import "../../styles/SlugAvailabilityInput.scss";

export function StudioSignupPage() {
  const navigate = useNavigate();
  const { getAccessToken, session, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugCheckStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCheckSlug = useCallback(
    async (value: string) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      return checkStudioSlug(value, token);
    },
    [getAccessToken],
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
        throw new Error("Sign in first");
      }
      await studioSignup(name.trim(), slug.trim(), token);
      navigate("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="auth-page">
        <p className="auth-page__eyebrow">Snapic Studio</p>
        <h1>Create your studio</h1>
        <p className="auth-page__lead">Sign in to register your photography studio on Snapic.</p>
        <button
          type="button"
          className="btn btn-primary auth-page__google"
          onClick={() => void signInWithGoogle("/studio/signup")}
        >
          Continue with Google
        </button>
        <Link className="auth-page__back" to="/for-photographers">
          Back to photographer info
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <p className="auth-page__eyebrow">Snapic Studio</p>
      <h1>Create your studio</h1>
      <p className="auth-page__lead">
        This name appears on guest galleries and your studio dashboard. You can change it later in
        settings.
      </p>
      <form className="auth-page__form auth-page__form--wide" onSubmit={handleSubmit}>
        <label htmlFor="name">Studio name</label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lens & Light Photography"
          autoComplete="organization"
        />
        <label htmlFor="slug">URL slug (optional)</label>
        <SlugAvailabilityInput
          id="slug"
          value={slug}
          onChange={setSlug}
          onCheckSlug={handleCheckSlug}
          onStatusChange={setSlugStatus}
          disabled={busy}
          placeholder="lens-and-light"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || slugBlocksSubmit}>
          {busy ? "Creating…" : "Create studio"}
        </button>
      </form>
      {error && <p className="error-banner">{error}</p>}
      <Link className="auth-page__back" to="/">
        Back home
      </Link>
    </div>
  );
}
