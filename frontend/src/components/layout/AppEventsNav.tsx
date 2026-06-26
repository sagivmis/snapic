import { Link, useLocation } from "react-router-dom";
import { useUserEvents, eventManagePath } from "../../hooks/useUserEvents";
import { APP_SIDEBAR_SECTIONS } from "../../lib/appSidebarSections";
import { AppSidebarSection } from "./AppSidebarSection";

export function AppEventsNav() {
  const location = useLocation();
  const { events, loading } = useUserEvents();

  if (loading || events.length === 0) {
    return null;
  }

  const hasActiveChild = events.some((event) => location.pathname.startsWith(`/e/${event.slug}`));

  return (
    <AppSidebarSection
      config={APP_SIDEBAR_SECTIONS.yourEvents}
      hasActiveChild={hasActiveChild}
      badge={events.length}
    >
      {events.map((event) => {
        const path = eventManagePath(event);
        const active = location.pathname.startsWith(`/e/${event.slug}`);
        return (
          <Link
            key={event.id}
            to={path}
            className={`app-layout__nav-link${active ? " app-layout__nav-link--active" : ""}`}
          >
            {event.title}
          </Link>
        );
      })}
    </AppSidebarSection>
  );
}
