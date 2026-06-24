import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import "../../styles/StudioLayout.scss";

const NAV = [
  { to: "/studio", label: "Dashboard", end: true },
  { to: "/studio/clients", label: "Clients" },
  { to: "/studio/settings", label: "Settings" },
  { to: "/studio/billing", label: "Billing" },
  { to: "/studio/team", label: "Team" },
];

export function StudioLayout() {
  const { profile, signOut, isSuperAdmin } = useAuth();
  const location = useLocation();

  return (
    <div className="studio-layout">
      <aside className="studio-layout__sidebar">
        <div className="studio-layout__brand">
          <Link to="/studio">Snapic Studio</Link>
        </div>
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
