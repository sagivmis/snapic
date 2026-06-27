import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchEventAssignees,
  fetchStudioTeam,
  updateEventAssignees,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "../../i18n";

interface ClientAssigneesPanelProps {
  eventId: string;
}

export function ClientAssigneesPanel({ eventId }: ClientAssigneesPanelProps) {
  const { getAccessToken } = useAuth();
  const { t, tPath } = useTranslation("studio.clientDetail.assignees");
  const [team, setTeam] = useState<Array<{ user_id: string; role: string; email?: string; full_name?: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const associates = useMemo(
    () => team.filter((member) => member.role === "associate"),
    [team],
  );

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [members, assignees] = await Promise.all([
        fetchStudioTeam(token),
        fetchEventAssignees(eventId, token),
      ]);
      setTeam(members);
      setSelected(new Set(assignees.assignees.map((row) => row.user_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, getAccessToken, tPath]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await updateEventAssignees(eventId, Array.from(selected), token);
      setSuccess(tPath("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p>{t("loading")}</p>;
  }

  if (associates.length === 0) {
    return <p>{tPath("noAssociates")}</p>;
  }

  return (
    <section className="studio-assignees">
      <h2>{tPath("title")}</h2>
      <p>{tPath("hint")}</p>
      <ul className="studio-assignees__list">
        {associates.map((member) => (
          <li key={member.user_id}>
            <label className="studio-assignees__item">
              <input
                type="checkbox"
                checked={selected.has(member.user_id)}
                onChange={() => toggle(member.user_id)}
              />
              <span>
                {member.full_name || member.email || member.user_id}
                {member.email && member.full_name ? ` · ${member.email}` : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleSave()}>
        {busy ? t("saving") : tPath("save")}
      </button>
      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </section>
  );
}
