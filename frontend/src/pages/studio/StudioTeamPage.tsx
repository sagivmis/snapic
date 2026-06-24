import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  checkStudioTeamEmail,
  fetchStudioTeam,
  fetchStudioTeamPendingInvites,
  inviteStudioTeamMember,
  type StudioOrgInvite,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { StudioTeamMembersSkeleton } from "../../components/studio/StudioSkeletons";
import { useTranslation } from "../../i18n";
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
  | { registered: boolean; already_member: boolean; invite_pending: boolean; can_invite: boolean };

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

function formatInviteDate(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StudioTeamPage() {
  const { getAccessToken } = useAuth();
  const { memberRole } = useStudioOrg();
  const { t, tPath } = useTranslation("studio.team");
  const { tPath: tRole } = useTranslation("studio.roles");
  const isOwner = memberRole === "owner";
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<StudioOrgInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"associate" | "owner">("associate");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [emailCheck, setEmailCheck] = useState<EmailCheckState>(null);
  const requestGeneration = useRef(0);

  const formatRole = useCallback(
    (roleValue: string) => {
      if (roleValue === "owner") {
        return tRole("owner");
      }
      if (roleValue === "associate") {
        return tRole("associate");
      }
      return roleValue;
    },
    [tRole],
  );

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const memberRows = await fetchStudioTeam(token);
      setMembers(memberRows);
      if (isOwner) {
        setPendingInvites(await fetchStudioTeamPendingInvites(token));
      } else {
        setPendingInvites([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, isOwner, t]);

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
            throw new Error(t("notSignedIn"));
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
  }, [email, getAccessToken, t]);

  const emailAlreadyMember = emailCheck !== null && emailCheck !== "checking" && emailCheck.already_member;
  const emailInvitePending =
    emailCheck !== null && emailCheck !== "checking" && emailCheck.invite_pending;
  const emailRegistered =
    emailCheck !== null &&
    emailCheck !== "checking" &&
    emailCheck.registered &&
    !emailCheck.already_member &&
    !emailCheck.invite_pending;
  const emailChecking = emailPending || emailCheck === "checking";
  const inviteBlocked = emailChecking || emailAlreadyMember || emailInvitePending;

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
        throw new Error(t("notSignedIn"));
      }
      await inviteStudioTeamMember(email.trim(), role, token);
      setEmail("");
      setEmailCheck(null);
      setSuccess(tPath("inviteSent"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("inviteFailed"));
    }
  }

  return (
    <div className="studio-page">
      <h1>{tPath("title")}</h1>

      <div className="studio-team-members__panel" aria-busy={loading}>
        {loading ? (
          <StudioTeamMembersSkeleton />
        ) : members.length === 0 ? (
          <p className="studio-team-members__empty">{tPath("noMembers")}</p>
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

      {isOwner && pendingInvites.length > 0 && (
        <section className="studio-team-pending">
          <h2 className="studio-team-pending__heading">{tPath("pendingInvites")}</h2>
          <p className="studio-team-pending__hint">{tPath("pendingHint")}</p>
          <ul className="studio-team-pending__list">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="studio-team-pending__item">
                <span className="studio-team-pending__email">{invite.email}</span>
                <span className="studio-team-pending__meta">
                  {invite.created_at
                    ? tPath("sentMeta", {
                        role: formatRole(invite.role),
                        date: formatInviteDate(invite.created_at),
                      })
                    : formatRole(invite.role)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <form className="studio-form studio-team-invite" onSubmit={handleInvite}>
          <h2 className="studio-team-invite__heading">{tPath("inviteHeading")}</h2>
          <label htmlFor="email">{tPath("emailLabel")}</label>
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
              <p className="slug-field__message slug-field__message--checking">{tPath("checkingEmail")}</p>
            )}
            {emailAlreadyMember && (
              <p className="slug-field__message slug-field__message--error" role="alert">
                {tPath("alreadyMember")}
              </p>
            )}
            {emailInvitePending && (
              <p className="slug-field__message slug-field__message--error" role="alert">
                {tPath("invitePending")}
              </p>
            )}
            {emailRegistered && (
              <p className="slug-field__message slug-field__message--checking">{tPath("registeredHint")}</p>
            )}
          </div>
          <label htmlFor="role">{tPath("roleLabel")}</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as "associate" | "owner")}>
            <option value="associate">{tRole("associate")}</option>
            <option value="owner">{tRole("owner")}</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={inviteBlocked}>
            {tPath("inviteBtn")}
          </button>
        </form>
      )}

      {success && <p className="success-banner">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
