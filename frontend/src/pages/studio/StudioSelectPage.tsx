import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  acceptStudioInvite,
  declineStudioInvite,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "../../components/studio/StudioOrgContext";
import { setStoredStudioOrgId } from "../../lib/studioOrg";
import "../../styles/AuthPages.scss";
import "../../styles/StudioLayout.scss";

export function StudioSelectPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { organizations, pendingInvites, refreshMembership, setActiveOrgId } = useStudioOrg();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error("Not signed in");
      }
      await acceptStudioInvite(inviteId, token);
      await refreshMembership();
      await enterStudio(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
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
        throw new Error("Not signed in");
      }
      await declineStudioInvite(inviteId, token);
      await refreshMembership();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline invite");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="auth-page studio-select">
      <p className="auth-page__eyebrow">Snapic Studio</p>
      <h1>Choose a studio</h1>
      <p className="auth-page__lead">
        Pick which studio to manage, or respond to pending invitations below.
      </p>

      {pendingInvites.length > 0 && (
        <section className="studio-select__section">
          <h2>Pending invitations</h2>
          <ul className="studio-select__list">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="studio-select__item">
                <div>
                  <strong>{invite.org_name ?? "Studio invite"}</strong>
                  <p>
                    Join as {invite.role === "owner" ? "owner" : "associate"}
                    {invite.invited_by_email ? ` · invited by ${invite.invited_by_email}` : ""}
                  </p>
                </div>
                <div className="studio-select__actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === invite.id}
                    onClick={() => void handleDecline(invite.id)}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === invite.id}
                    onClick={() => void handleAccept(invite.id, invite.org_id)}
                  >
                    Accept
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {organizations.length > 0 && (
        <section className="studio-select__section">
          <h2>Your studios</h2>
          <ul className="studio-select__list">
            {organizations.map((org) => (
              <li key={org.id} className="studio-select__item">
                <div>
                  <strong>{org.name}</strong>
                  <p>
                    {org.member_role === "owner" ? "Owner" : "Associate"} · {org.slug}
                  </p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => void enterStudio(org.id)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {organizations.length === 0 && pendingInvites.length === 0 && (
        <p>No studios yet.</p>
      )}

      {error && <p className="error-banner">{error}</p>}

      <Link className="auth-page__back" to="/studio/signup">
        Create your own studio
      </Link>
    </div>
  );
}
