import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyEvents } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type { UserEventSummary } from "../types";
import "../styles/MyEventsSelect.scss";

function formatEventLabel(event: UserEventSummary): string {
  if (event.search_count > 0) {
    return `${event.title} (${event.search_count} search${event.search_count === 1 ? "" : "es"})`;
  }
  if (event.is_admin) {
    return `${event.title} (admin)`;
  }
  return event.title;
}

export function MyEventsSelect() {
  const navigate = useNavigate();
  const { session, getAccessToken } = useAuth();
  const [events, setEvents] = useState<UserEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error("Not signed in");
        }
        setEvents(await fetchMyEvents(token));
      } catch (err) {
        setEvents([]);
        setError(err instanceof Error ? err.message : "Could not load events");
      } finally {
        setLoading(false);
      }
    })();
  }, [session, getAccessToken]);

  if (loading) {
    return (
      <div className="my-events-select my-events-select--loading" aria-busy="true">
        <span className="spinner" />
        <span>Loading events…</span>
      </div>
    );
  }

  if (error) {
    return <p className="my-events-select__error">{error}</p>;
  }

  if (events.length === 0) {
    return (
      <div className="my-events-select my-events-select--empty btn btn-primary" aria-disabled="true">
        No events yet
      </div>
    );
  }

  return (
    <label className="my-events-select">
      <span className="visually-hidden">Go to one of your events</span>
      <select
        className="my-events-select__control btn btn-primary"
        defaultValue=""
        onChange={(selectEvent) => {
          const slug = selectEvent.target.value;
          if (!slug) {
            return;
          }
          const event = events.find((item) => item.slug === slug);
          const path = event?.is_admin
            ? event.needs_onboarding
              ? `/e/${slug}/setup`
              : `/e/${slug}/manage`
            : `/e/${slug}`;
          navigate(path);
          selectEvent.target.value = "";
        }}
      >
        <option value="" disabled>
          Your events
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.slug}>
            {formatEventLabel(event)}
          </option>
        ))}
      </select>
    </label>
  );
}
