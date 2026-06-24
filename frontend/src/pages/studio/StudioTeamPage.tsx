import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchStudioTeam, inviteStudioTeamMember } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import "../../styles/StudioLayout.scss";

export function StudioTeamPage() {
  const { getAccessToken } = useAuth();
  const [members, setMembers] = useState<Array<{ user_id: string; role: string; email?: string; full_name?: string }>>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"associate" | "owner">("associate");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    setMembers(await fetchStudioTeam(token));
  }, [getAccessToken]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await inviteStudioTeamMember(email.trim(), role, token);
      setEmail("");
      setSuccess("Invite sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  return (
    <div className="studio-page">
      <h1>Team</h1>
      <ul>
        {members.map((member) => (
          <li key={member.user_id}>
            {member.full_name || member.email || member.user_id} · {member.role}
          </li>
        ))}
      </ul>
      <form className="studio-form" onSubmit={handleInvite}>
        <label htmlFor="email">Invite email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="role">Role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as "associate" | "owner")}>
          <option value="associate">Associate</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Send invite
        </button>
      </form>
      {success && <p>{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
