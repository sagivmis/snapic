import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchStudioSettings, updateStudioSettings } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { Organization } from "../../types";
import "../../styles/StudioLayout.scss";

export function StudioSettingsPage() {
  const { getAccessToken } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [accent, setAccent] = useState("#c9a962");
  const [requireCoupleGoLive, setRequireCoupleGoLive] = useState(false);
  const [associateScope, setAssociateScope] = useState<"org" | "event">("org");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    const row = await fetchStudioSettings(token);
    setOrg(row);
    setName(row.name);
    setWebsite(row.website_url ?? "");
    setAccent(row.accent_color ?? "#c9a962");
    const settings = row.settings ?? {};
    setRequireCoupleGoLive(Boolean(settings.require_couple_go_live));
    setAssociateScope(settings.associate_scope === "event" ? "event" : "org");
  }, [getAccessToken]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

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
      setOrg(updated);
      setSuccess("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!org) {
    return <div className="studio-page">Loading…</div>;
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

        <label>
          <input
            type="checkbox"
            checked={requireCoupleGoLive}
            onChange={(e) => setRequireCoupleGoLive(e.target.checked)}
          />{" "}
          Require couple approval before go-live
        </label>

        <label htmlFor="scope">Associate access</label>
        <select id="scope" value={associateScope} onChange={(e) => setAssociateScope(e.target.value as "org" | "event")}>
          <option value="org">All studio events</option>
          <option value="event">Assigned events only</option>
        </select>

        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </form>
      {success && <p>{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
