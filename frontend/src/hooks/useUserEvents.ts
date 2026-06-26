import { useEffect, useState } from "react";
import { fetchMyEvents } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type { UserEventSummary } from "../types";

export function eventManagePath(event: UserEventSummary): string {
  if (event.is_admin) {
    return event.needs_onboarding ? `/e/${event.slug}/setup` : `/e/${event.slug}/manage`;
  }
  return `/e/${event.slug}`;
}

export function useUserEvents() {
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

  return { events, loading, hasEvents: events.length > 0 };
}
