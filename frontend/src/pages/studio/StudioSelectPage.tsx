import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  acceptStudioInvite,
  declineStudioInvite,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { setStoredStudioOrgId } from "../../lib/studioOrg";
import { useTranslation } from "../../i18n";
import "../../styles/AuthPages.scss";
import "../../styles/StudioLayout.scss";

export function StudioSelectPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { organizations, pendingInvites, refreshMembership, setActiveOrgId } = useStudioOrg();
  const { t, tPath } = useTranslation("studio.select");
  const { tPath: tRole } = useTranslation("studio.roles");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function formatRole(role: string): string {
    if (role === "owner") {
      return tRole("owner");
    }
    if (role === "associate") {
      return tRole("associate");
    }
    return role;
  }

  async function enterStudio(orgId: string) {
    setStoredStudioOrgId(orgId);
    setActiveOrgId(orgId);
    navigate("/studio");
  }

  async function handleAccept(inviteId: string, orgId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await acceptStudioInvite(inviteId, token);
      await refreshMembership();
      await enterStudio(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("acceptFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error(t("notSignedIn"));
      }
      await declineStudioInvite(inviteId, token);
      await refreshMembership();
    } catch (err) {
      setError(err instanceof Error ? err.message : tPath("declineFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="auth-page studio-select">
      <p className="auth-page__eyebrow">{tPath("eyebrow")}</p>
      <h1>{tPath("title")}</h1>
      <p className="auth-page__lead">{tPath("lead")}</p>

      {pendingInvites.length > 0 && (
        <section className="studio-select__section">
          <h2>{tPath("pendingInvites")}</h2>
          <ul className="studio-select__list">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="studio-select__item">
                <div>
                  <strong>{invite.org_name ?? tPath("studioInviteFallback")}</strong>
                  <p>
                    {tPath("joinAs", { role: formatRole(invite.role) })}
                    {invite.invited_by_email
                      ? ` · ${tPath("invitedBy", { email: invite.invited_by_email })}`
                      : ""}
                  </p>
                </div>
                <div className="studio-select__actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === invite.id}
                    onClick={() => void handleDecline(invite.id)}
                  >
                    {t("decline")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === invite.id}
                    onClick={() => void handleAccept(invite.id, invite.org_id)}
                  >
                    {t("accept")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {organizations.length > 0 && (
        <section className="studio-select__section">
          <h2>{tPath("yourStudios")}</h2>
          <ul className="studio-select__list">
            {organizations.map((org) => (
              <li key={org.id} className="studio-select__item">
                <div>
                  <strong>{org.name}</strong>
                  <p>
                    {formatRole(org.member_role ?? "associate")} · {org.slug}
                  </p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => void enterStudio(org.id)}>
                  {tPath("open")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {organizations.length === 0 && pendingInvites.length === 0 && (
        <p>{tPath("noStudios")}</p>
      )}

      {error && <p className="error-banner">{error}</p>}

      <Link className="auth-page__back" to="/studio/signup">
        {tPath("createOwn")}
      </Link>
    </div>
  );
}
