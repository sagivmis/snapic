import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchStudioMe } from "../../api/client";
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

export function RequireOrgMember({ children }: { children: React.ReactNode }) {
  const { getAccessToken, loading, session, isSuperAdmin } = useAuth();
  const [orgReady, setOrgReady] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    if (isSuperAdmin) {
      setOrgReady(true);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setOrgReady(false);
      return;
    }
    try {
      await fetchStudioMe(token);
      setOrgReady(true);
    } catch {
      setOrgReady(false);
    }
  }, [getAccessToken, isSuperAdmin]);

  useEffect(() => {
    if (!loading && session) {
      void check();
    }
  }, [loading, session, check]);

  if (loading || orgReady === null) {
    return <div className="studio-layout studio-layout--loading">Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/login?next=/studio" replace />;
  }
  if (!orgReady) {
    return <Navigate to="/studio/signup" replace />;
  }
  return <>{children}</>;
}
