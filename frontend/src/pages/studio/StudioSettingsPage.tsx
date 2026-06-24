import { FormEvent, useEffect, useState } from "react";
import { updateStudioSettings } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
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
  };
}

export function StudioSettingsPage() {
  const { organization, setOrganization } = useStudioOrg();
  const { getAccessToken } = useAuth();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [accent, setAccent] = useState("#c9a962");
  const [requireCoupleGoLive, setRequireCoupleGoLive] = useState(false);
  const [associateScope, setAssociateScope] = useState<"org" | "event">("org");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      const form = applyOrgToForm(organization);
      setName(form.name);
      setWebsite(form.website);
      setAccent(form.accent);
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
        throw new Error("Not signed in");
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
      setSuccess("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="studio-page">
      <h1>Studio settings</h1>
      <form className="studio-form" onSubmit={handleSubmit}>
        <label htmlFor="name">Studio name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="website">Website</label>
        <input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />

        <label htmlFor="accent">Accent color</label>
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
              Require couple approval before go-live
            </span>
            <span className="studio-form__toggle-hint">
              {requireCoupleGoLive
                ? "Couples must approve before the gallery goes live."
                : "You can go live without waiting for couple approval."}
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
              All studio events
            </span>
            <span className="studio-form__toggle-hint">
              {associateScope === "org"
                ? "Associates can access every client gallery in your studio."
                : "Associates only see events they’re assigned to."}
            </span>
          </span>
        </div>

        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </form>
      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
