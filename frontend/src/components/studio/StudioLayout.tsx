import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioOrg } from "./StudioOrgContext";
import "../../styles/StudioLayout.scss";

const NAV = [
  { to: "/studio", label: "Dashboard", end: true },
  { to: "/studio/clients", label: "Clients" },
  { to: "/studio/settings", label: "Settings" },
  { to: "/studio/billing", label: "Billing" },
  { to: "/studio/team", label: "Team" },
];

export function StudioLayout() {
  const navigate = useNavigate();
  const { profile, signOut, isSuperAdmin } = useAuth();
  const { organization, organizations, pendingInvites, activeOrgId, setActiveOrgId } = useStudioOrg();
  const location = useLocation();

  return (
    <div className="studio-layout">
      <aside className="studio-layout__sidebar">
        <div className="studio-layout__brand">
          <Link to="/studio">Snapic Studio</Link>
        </div>

        {organizations.length > 1 && organization && (
          <label className="studio-layout__switcher">
            <span className="studio-layout__switcher-label">Studio</span>
            <select
              className="studio-layout__switcher-select"
              value={activeOrgId ?? organization.id}
              onChange={(event) => {
                setActiveOrgId(event.target.value);
                if (location.pathname !== "/studio") {
                  navigate("/studio");
                }
              }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {pendingInvites.length > 0 && (
          <Link to="/studio/select" className="studio-layout__invites-link">
            Pending invitations ({pendingInvites.length})
          </Link>
        )}

        <nav className="studio-layout__nav">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`studio-layout__nav-link${active ? " studio-layout__nav-link--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="studio-layout__footer">
          <p className="studio-layout__user">{profile?.email}</p>
          {organizations.length > 1 && (
            <Link to="/studio/select" className="studio-layout__admin-link">
              Switch studio
            </Link>
          )}
          {isSuperAdmin && (
            <Link to="/admin" className="studio-layout__admin-link">
              Platform admin
            </Link>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="studio-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
