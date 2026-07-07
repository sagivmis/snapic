import { FormEvent, useEffect, useRef, useState } from "react";
import { deleteStudioLogo, deleteMyAccount, updateStudioSettings, uploadStudioLogo } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { useTranslation } from "../../i18n";
import type { Organization } from "../../types";
import "../../styles/StudioLayout.scss";

function applyOrgToForm(org: Organization) {
  const settings = org.settings ?? {};
  return {
    name: org.name,
    website: org.website_url ?? "",
    accent: org.accent_color ?? "#c9a962",
    requireCoupleGoLive: Boolean(settings.require_couple_go_live),
    associateScope: settings.associate_scope === "event" ? ("event" as const) : ("org" as const),
    logoUrl: org.logo_url ?? null,
  };
}

export function StudioSettingsPage() {
  const { organization, setOrganization } = useStudioOrg();
  const { getAccessToken, signOut } = useAuth();
  const { t, tPath } = useTranslation("studio.settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [accent, setAccent] = useState("#c9a962");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [requireCoupleGoLive, setRequireCoupleGoLive] = useState(false);
  const [associateScope, setAssociateScope] = useState<"org" | "event">("org");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (organization) {
      const form = applyOrgToForm(organization);
      setName(form.name);
      setWebsite(form.website);
      setAccent(form.accent);
      setLogoUrl(form.logoUrl);
      setRequireCoupleGoLive(form.requireCoupleGoLive);
      setAssociateScope(form.associateScope);
    }
  }, [organization]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await updateStudioSettings(
        {
          name,
          website_url: website || null,
          accent_color: accent,
          settings: {
            require_couple_go_live: requireCoupleGoLive,
            associate_scope: associateScope,
          },
        },
        token,
      );
      setOrganization(updated);
      setLogoUrl(updated.logo_url ?? null);
      setSuccess(tPath("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!file) {
      return;
    }
    setLogoBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await uploadStudioLogo(file, token);
      setOrganization(updated);
      setLogoUrl(updated.logo_url ?? null);
      setSuccess(tPath("logoUploaded"));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("logoUploadFailed"));
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveLogo() {
    setLogoBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      const updated = await deleteStudioLogo(token);
      setOrganization(updated);
      setLogoUrl(null);
      setSuccess(tPath("logoRemoved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("logoRemoveFailed"));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm(tPath("deleteAccountConfirm"))) {
      return;
    }
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await deleteMyAccount(token);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("deleteAccountFailed"));
    }
  }

  return (
    <div className="studio-page">
      <h1>{tPath("title")}</h1>
      <form className="studio-form" onSubmit={handleSubmit}>
        <div className="studio-form__logo">
          <label>{tPath("logoLabel")}</label>
          <div className="studio-form__logo-row">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="studio-form__logo-preview" />
            ) : (
              <div className="studio-form__logo-placeholder" aria-hidden="true" />
            )}
            <div className="studio-form__logo-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => void handleLogoChange(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={logoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {logoUrl ? tPath("logoReplace") : tPath("logoUpload")}
              </button>
              {logoUrl && (
                <button type="button" className="btn btn-ghost" disabled={logoBusy} onClick={() => void handleRemoveLogo()}>
                  {tPath("logoRemove")}
                </button>
              )}
            </div>
          </div>
          <p className="studio-form__hint">{tPath("logoHint")}</p>
        </div>

        <label htmlFor="name">{tPath("studioNameLabel")}</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="website">{tPath("websiteLabel")}</label>
        <input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />

        <label htmlFor="accent">{tPath("accentLabel")}</label>
        <input id="accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />

        <div className="studio-form__toggle">
          <button
            type="button"
            role="switch"
            id="require-couple-go-live"
            className={`studio-form__switch${requireCoupleGoLive ? " studio-form__switch--on" : ""}`}
            aria-checked={requireCoupleGoLive}
            aria-labelledby="require-couple-go-live-label"
            onClick={() => setRequireCoupleGoLive((value) => !value)}
          >
            <span className="studio-form__switch-thumb" aria-hidden="true" />
          </button>
          <span className="studio-form__toggle-copy">
            <span id="require-couple-go-live-label" className="studio-form__toggle-label">
              {tPath("requireCoupleGoLiveLabel")}
            </span>
            <span className="studio-form__toggle-hint">
              {requireCoupleGoLive ? tPath("requireCoupleGoLiveOn") : tPath("requireCoupleGoLiveOff")}
            </span>
          </span>
        </div>

        <div className="studio-form__toggle">
          <button
            type="button"
            role="switch"
            id="associate-access"
            className={`studio-form__switch${associateScope === "org" ? " studio-form__switch--on" : ""}`}
            aria-checked={associateScope === "org"}
            aria-labelledby="associate-access-label"
            onClick={() => setAssociateScope(associateScope === "org" ? "event" : "org")}
          >
            <span className="studio-form__switch-thumb" aria-hidden="true" />
          </button>
          <span className="studio-form__toggle-copy">
            <span id="associate-access-label" className="studio-form__toggle-label">
              {tPath("associateScopeLabel")}
            </span>
            <span className="studio-form__toggle-hint">
              {associateScope === "org" ? tPath("associateScopeOn") : tPath("associateScopeOff")}
            </span>
          </span>
        </div>

        {associateScope === "event" && (
          <p className="studio-form__warning" role="status">
            {tPath("associateScopeWarning")}
          </p>
        )}

        <button type="submit" className="btn btn-primary">
          {t("save")}
        </button>
      </form>
      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}

      <section className="studio-form studio-form--danger">
        <h2>{tPath("accountTitle")}</h2>
        <p className="studio-form__hint">{tPath("deleteAccountHint")}</p>
        <button type="button" className="btn btn-ghost" onClick={() => void handleDeleteAccount()}>
          {tPath("deleteAccountBtn")}
        </button>
      </section>
    </div>
  );
}
