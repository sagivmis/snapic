import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { checkStudioTeamEmail, fetchStudioTeam, inviteStudioTeamMember } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { StudioTeamMembersSkeleton } from "../../components/studio/StudioSkeletons";
import "../../styles/StudioLayout.scss";
import "../../styles/SlugAvailabilityInput.scss";

const EMAIL_CHECK_DEBOUNCE_MS = 500;

type TeamMember = {
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
};

type EmailCheckState =
  | null
  | "checking"
  | { registered: boolean; already_member: boolean; can_invite: boolean };

function formatRole(role: string): string {
  if (role === "owner") {
    return "Owner";
  }
  if (role === "associate") {
    return "Associate";
  }
  return role;
}

function capitalizeDisplayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function memberDisplayName(member: TeamMember): string {
  const name = member.full_name?.trim();
  if (name) {
    return capitalizeDisplayName(name);
  }
  const email = member.email?.trim();
  if (email) {
    const at = email.indexOf("@");
    const local = at > 0 ? email.slice(0, at) : email;
    return capitalizeDisplayName(local.replace(/[._-]+/g, " "));
  }
  return member.user_id;
}

export function StudioTeamPage() {
  const { getAccessToken } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"associate" | "owner">("associate");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [emailCheck, setEmailCheck] = useState<EmailCheckState>(null);
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setMembers(await fetchStudioTeam(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) {
      setEmailCheck(null);
      setEmailPending(false);
      return;
    }

    setEmailCheck(null);
    setEmailPending(true);

    const timer = window.setTimeout(() => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;
      setEmailPending(false);
      setEmailCheck("checking");

      void getAccessToken()
        .then((token) => {
          if (!token) {
            throw new Error("Not signed in");
          }
          return checkStudioTeamEmail(cleaned, token);
        })
        .then((result) => {
          if (requestGeneration.current !== generation) {
            return;
          }
          setEmailCheck(result);
        })
        .catch(() => {
          if (requestGeneration.current !== generation) {
            return;
          }
          setEmailCheck(null);
        });
    }, EMAIL_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      requestGeneration.current += 1;
    };
  }, [email, getAccessToken]);

  const emailAlreadyMember = emailCheck !== null && emailCheck !== "checking" && emailCheck.already_member;
  const emailRegistered =
    emailCheck !== null && emailCheck !== "checking" && emailCheck.registered && !emailCheck.already_member;
  const emailChecking = emailPending || emailCheck === "checking";
  const inviteBlocked = emailChecking || emailAlreadyMember;

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (inviteBlocked) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const result = await inviteStudioTeamMember(email.trim(), role, token);
      setEmail("");
      setEmailCheck(null);
      setSuccess(result.status === "added" ? "Added to your team." : "Invite sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  return (
    <div className="studio-page">
      <h1>Team</h1>

      <div className="studio-team-members__panel" aria-busy={loading}>
        {loading ? (
          <StudioTeamMembersSkeleton />
        ) : members.length === 0 ? (
          <p className="studio-team-members__empty">No team members yet. Invite someone below.</p>
        ) : (
          <ul className="studio-team-members__grid">
            {members.map((member) => (
              <li
                key={member.user_id}
                className={`studio-team-members__tile studio-team-members__tile--${member.role}`}
              >
                <span className="studio-team-members__name">{memberDisplayName(member)}</span>
                <span className="studio-team-members__role">{formatRole(member.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="studio-form studio-team-invite" onSubmit={handleInvite}>
        <h2 className="studio-team-invite__heading">Invite teammate</h2>
        <label htmlFor="email">Invite email</label>
        <div className="slug-field">
          <div className={`slug-field__control${emailAlreadyMember ? " slug-field__control--error" : ""}`}>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailAlreadyMember || undefined}
              aria-busy={emailChecking || undefined}
            />
          </div>
          {emailChecking && (
            <p className="slug-field__message slug-field__message--checking">Checking email…</p>
          )}
          {emailAlreadyMember && (
            <p className="slug-field__message slug-field__message--error" role="alert">
              This person is already on your team.
            </p>
          )}
          {emailRegistered && (
            <p className="slug-field__message slug-field__message--checking">
              They already have a Snapic account — we&apos;ll add them directly when you send the invite.
            </p>
          )}
        </div>
        <label htmlFor="role">Role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as "associate" | "owner")}>
          <option value="associate">Associate</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={inviteBlocked}>
          Send invite
        </button>
      </form>

      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
