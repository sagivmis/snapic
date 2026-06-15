import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import "../styles/MyEventsSelect.scss";

interface UserEventOption {
  id: string;
  slug: string;
  title: string;
}

async function loadUserEvents(userId: string, isSuperAdmin: boolean): Promise<UserEventOption[]> {
  if (!supabase) {
    return [];
  }

  if (isSuperAdmin) {
    const { data, error } = await supabase
      .from("events")
      .select("id, slug, title")
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("event_members")
    .select("events ( id, slug, title )")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const events: UserEventOption[] = [];
  for (const row of data ?? []) {
    const event = row.events as UserEventOption | UserEventOption[] | null;
    const resolved = Array.isArray(event) ? event[0] : event;
    if (resolved?.slug) {
      events.push(resolved);
    }
  }

  return events.sort((a, b) => a.title.localeCompare(b.title));
}

export function MyEventsSelect() {
  const navigate = useNavigate();
  const { session, isSuperAdmin } = useAuth();
  const [events, setEvents] = useState<UserEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void loadUserEvents(session.user.id, isSuperAdmin)
      .then(setEvents)
      .catch((err) => {
        setEvents([]);
        setError(err instanceof Error ? err.message : "Could not load events");
      })
      .finally(() => setLoading(false));
  }, [session?.user?.id, isSuperAdmin]);

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
      <span className="visually-hidden">Go to your event</span>
      <select
        className="my-events-select__control btn btn-primary"
        defaultValue=""
        onChange={(event) => {
          const slug = event.target.value;
          if (slug) {
            navigate(`/e/${slug}/manage`);
            event.target.value = "";
          }
        }}
      >
        <option value="" disabled>
          Your events
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.slug}>
            {event.title}
          </option>
        ))}
      </select>
    </label>
  );
}
