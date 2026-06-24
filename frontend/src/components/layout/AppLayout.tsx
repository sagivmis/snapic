import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioMembership } from "../../hooks/useStudioMembership";
import { isSupabaseConfigured } from "../../lib/supabase";
import { AppEventsNav } from "./AppEventsNav";
import { AppStudioNav } from "./AppStudioNav";
import "../../styles/AppLayout.scss";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function AppLayout() {
  const location = useLocation();
  const { session, profile, isSuperAdmin, isPhotographer, signOut } = useAuth();
  const { hasStudios, pendingInvites, loaded } = useStudioMembership();

  const showStudioNav = isSuperAdmin || isPhotographer || hasStudios || pendingInvites.length > 0;
  const showForPhotographers = isSupabaseConfigured && loaded && !hasStudios;

  const primaryNav: NavItem[] = [{ to: "/", label: "Home", end: true }];

  if (isSuperAdmin) {
    primaryNav.push({ to: "/admin", label: "Admin dashboard", end: true });
  }
  if (showForPhotographers) {
    primaryNav.push({ to: "/for-photographers", label: "For photographers" });
  }
  if (isSupabaseConfigured) {
    primaryNav.push({ to: "/request-access", label: "Request gallery" });
  }
  primaryNav.push({ to: "/demo", label: "Try demo", end: true });

  function isActive(item: NavItem): boolean {
    if (item.end) {
      return location.pathname === item.to;
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  return (
    <div className="app-layout">
      <aside className="app-layout__sidebar">
        <div className="app-layout__brand">
          <Link to="/">Snapic</Link>
        </div>

        <div className="app-layout__sidebar-body">
          <nav className="app-layout__nav app-layout__nav--primary" aria-label="Main">
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`app-layout__nav-link${isActive(item) ? " app-layout__nav-link--active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {showStudioNav && <AppStudioNav />}
          <AppEventsNav />
        </div>

        <div className="app-layout__footer">
          {session ? (
            <>
              <p className="app-layout__user">{profile?.email ?? session.user.email}</p>
              <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : isSupabaseConfigured ? (
            <Link to="/login" className="app-layout__sign-in">
              Sign in
            </Link>
          ) : null}
        </div>
      </aside>
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
