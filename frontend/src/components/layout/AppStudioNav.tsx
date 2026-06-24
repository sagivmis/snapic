import { Link, useLocation } from "react-router-dom";
import { useStudioMembership } from "../../hooks/useStudioMembership";
import { useTranslation } from "../../i18n";
import { APP_SIDEBAR_SECTIONS } from "../../lib/appSidebarSections";
import { AppSidebarSection } from "./AppSidebarSection";

const STUDIO_NAV = [
  { to: "/studio", labelKey: "dashboard", end: true },
  { to: "/studio/clients", labelKey: "clients" },
  { to: "/studio/settings", labelKey: "settings" },
  { to: "/studio/billing", labelKey: "billing" },
  { to: "/studio/team", labelKey: "team" },
] as const;

export function AppStudioNav() {
  const location = useLocation();
  const { organizations, pendingInvites } = useStudioMembership();
  const { tPath } = useTranslation("nav");
  const { tPath: tStudioNav } = useTranslation("studio.nav");

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
          {tPath("switchStudio")}
        </Link>
      )}
      {pendingInvites.length > 0 && (
        <Link to="/studio/select" className="app-layout__invites-link">
          {tPath("pendingInvites", { count: pendingInvites.length })}
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
          className={`app-layout__nav-link${isActive(item.to, "end" in item ? item.end : undefined) ? " app-layout__nav-link--active" : ""}`}
        >
          {tStudioNav(item.labelKey)}
        </Link>
      ))}
    </AppSidebarSection>
  );
}
