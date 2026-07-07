import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useStudioMembership } from "../../hooks/useStudioMembership";
import { useMobileNav } from "../../hooks/useMobileNav";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { SiteFooter } from "./SiteFooter";
import { useTranslation } from "../../i18n";
import { isSupabaseConfigured } from "../../lib/supabase";
import { AppEventsNav } from "./AppEventsNav";
import { AppStudioNav } from "./AppStudioNav";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";
import "../../styles/AppLayout.scss";

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
}

export function AppLayout() {
  const location = useLocation();
  const { session, profile, isSuperAdmin, isPhotographer, signOut } = useAuth();
  const { hasStudios, pendingInvites, loaded } = useStudioMembership();
  const { showChrome, tabs, isTabActive, sheetSections, events } = useMobileNav();
  const { tPath } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");

  const showStudioNav = isSuperAdmin || isPhotographer || hasStudios || pendingInvites.length > 0;
  const showForPhotographers = isSupabaseConfigured && loaded && !hasStudios;

  const primaryNav: NavItem[] = [{ to: "/", labelKey: "home", end: true }];

  if (isSuperAdmin) {
    primaryNav.push({ to: "/admin", labelKey: "adminDashboard", end: true });
  }
  if (showForPhotographers) {
    primaryNav.push({ to: "/for-photographers", labelKey: "forPhotographers" });
  }
  if (isSupabaseConfigured) {
    primaryNav.push({ to: "/request-access", labelKey: "requestGallery" });
  }
  primaryNav.push({ to: "/demo", labelKey: "tryDemo", end: true });

  function isActive(item: NavItem): boolean {
    if (item.end) {
      return location.pathname === item.to;
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  }

  return (
    <div className={`app-layout${showChrome ? " app-layout--mobile-chrome" : ""}`}>
      <aside className="app-layout__sidebar app-layout__sidebar--desktop">
        <div className="app-layout__brand">
          <Link to="/">{tCommon("brand")}</Link>
        </div>

        <div className="app-layout__sidebar-body">
          <nav className="app-layout__nav app-layout__nav--primary" aria-label={tPath("mainAria")}>
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`app-layout__nav-link${isActive(item) ? " app-layout__nav-link--active" : ""}`}
              >
                {tPath(item.labelKey)}
              </Link>
            ))}
          </nav>

          {showStudioNav && <AppStudioNav />}
          <AppEventsNav />
        </div>

        <div className="app-layout__footer">
          <LanguageSwitcher />
          {session ? (
            <>
              <p className="app-layout__user">{profile?.email ?? session.user.email}</p>
              <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
                {tCommon("signOut")}
              </button>
            </>
          ) : isSupabaseConfigured ? (
            <Link to="/login" className="app-layout__sign-in">
              {tCommon("signIn")}
            </Link>
          ) : null}
          <SiteFooter variant="inline" />
        </div>
      </aside>

      {showChrome && <MobileHeader />}

      <main className="app-layout__main">
        <Outlet />
      </main>

      {showChrome && (
        <MobileTabBar
          tabs={tabs}
          isTabActive={isTabActive}
          sheetSections={sheetSections}
          events={events}
        />
      )}
    </div>
  );
}
