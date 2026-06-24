import { Link, useLocation } from "react-router-dom";
import { useStudioMembership } from "../../hooks/useStudioMembership";
import { APP_SIDEBAR_SECTIONS } from "../../lib/appSidebarSections";
import { AppSidebarSection } from "./AppSidebarSection";

const STUDIO_NAV = [
  { to: "/studio", label: "Dashboard", end: true },
  { to: "/studio/clients", label: "Clients" },
  { to: "/studio/settings", label: "Settings" },
  { to: "/studio/billing", label: "Billing" },
  { to: "/studio/team", label: "Team" },
] as const;

export function AppStudioNav() {
  const location = useLocation();
  const { organizations, pendingInvites } = useStudioMembership();

  function isActive(to: string, end?: boolean): boolean {
    if (end) {
      return location.pathname === to;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  const hasActiveChild =
    location.pathname.startsWith("/studio") && !location.pathname.startsWith("/studio/signup");

  const headerExtra = (
    <>
      {organizations.length > 1 && (
        <Link to="/studio/select" className="app-layout__meta-link">
          Switch studio
        </Link>
      )}
      {pendingInvites.length > 0 && (
        <Link to="/studio/select" className="app-layout__invites-link">
          Pending invitations ({pendingInvites.length})
        </Link>
      )}
    </>
  );

  return (
    <AppSidebarSection
      config={APP_SIDEBAR_SECTIONS.studio}
      hasActiveChild={hasActiveChild}
      badge={pendingInvites.length > 0 ? pendingInvites.length : undefined}
      headerExtra={organizations.length > 1 || pendingInvites.length > 0 ? headerExtra : undefined}
    >
      {STUDIO_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`app-layout__nav-link${isActive(item.to, item.end) ? " app-layout__nav-link--active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </AppSidebarSection>
  );
}
