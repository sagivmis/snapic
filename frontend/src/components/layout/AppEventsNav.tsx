import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchMyEvents } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { APP_SIDEBAR_SECTIONS } from "../../lib/appSidebarSections";
import type { UserEventSummary } from "../../types";
import { AppSidebarSection } from "./AppSidebarSection";

function eventPath(event: UserEventSummary): string {
  if (event.is_admin) {
    return event.needs_onboarding ? `/e/${event.slug}/setup` : `/e/${event.slug}/manage`;
  }
  return `/e/${event.slug}`;
}

export function AppEventsNav() {
  const location = useLocation();
  const { session, getAccessToken } = useAuth();
  const [events, setEvents] = useState<UserEventSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setEvents([]);
          return;
        }
        setEvents(await fetchMyEvents(token));
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, getAccessToken]);

  if (!session || loading || events.length === 0) {
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
        const path = eventPath(event);
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
