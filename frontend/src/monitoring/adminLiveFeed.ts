import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface AdminLiveFeedItem {
  id: string;
  message: string;
  createdAt: string;
}

type Row = Record<string, unknown>;

function rowId(row: Row | undefined): string | null {
  if (!row || typeof row.id !== "string") {
    return null;
  }
  return row.id;
}

function formatAuditMessage(action: string, metadata: Row): string {
  const couple = typeof metadata.couple_names === "string" ? metadata.couple_names : null;
  const email = typeof metadata.email === "string" ? metadata.email : null;
  const slug =
    typeof metadata.event_slug === "string"
      ? metadata.event_slug
      : typeof metadata.slug === "string"
        ? metadata.slug
        : null;
  const title = typeof metadata.title === "string" ? metadata.title : null;

  switch (action) {
    case "signup.approve":
      return couple ? `Signup approved — ${couple}` : "Signup request approved";
    case "signup.reject":
      return couple ? `Signup rejected — ${couple}` : "Signup request rejected";
    case "event.create":
      return title ? `Event created — ${title}` : slug ? `Event created — /e/${slug}` : "Event created";
    case "event.update":
      return title ? `Event updated — ${title}` : slug ? `Event updated — /e/${slug}` : "Event updated";
    case "event.delete":
      return title ? `Event deleted — ${title}` : slug ? `Event deleted — /e/${slug}` : "Event deleted";
    case "event.invite":
      return email ? `Invite sent — ${email}` : "Event invite sent";
    case "sentry_test":
      return "Sentry test event sent";
    default:
      return action.replace(/\./g, " · ").replace(/_/g, " ");
  }
}

export function feedItemFromSignupChange(
  payload: RealtimePostgresChangesPayload<Row>,
): AdminLiveFeedItem | null {
  if (payload.eventType !== "INSERT") {
    return null;
  }
  const row = payload.new;
  const id = rowId(row);
  if (!id) {
    return null;
  }
  const couple = String(row?.couple_names ?? "Couple");
  const email = typeof row?.email === "string" ? row.email : "";
  return {
    id: `signup-insert-${id}`,
    message: `New signup request — ${couple}${email ? ` (${email})` : ""}`,
    createdAt: String(row?.created_at ?? new Date().toISOString()),
  };
}

export function feedItemFromAuditChange(
  payload: RealtimePostgresChangesPayload<Row>,
): AdminLiveFeedItem | null {
  if (payload.eventType !== "INSERT") {
    return null;
  }
  const row = payload.new;
  const id = rowId(row);
  if (!id || typeof row?.action !== "string") {
    return null;
  }
  const metadata = (row.metadata as Row | undefined) ?? {};
  const actor = typeof row.actor_email === "string" ? row.actor_email : null;
  const summary = formatAuditMessage(row.action, metadata);
  return {
    id: `audit-${id}`,
    message: actor ? `${summary} — ${actor}` : summary,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function feedItemFromEventChange(
  payload: RealtimePostgresChangesPayload<Row>,
): AdminLiveFeedItem | null {
  if (payload.eventType !== "INSERT") {
    return null;
  }
  const row = payload.new;
  const id = rowId(row);
  if (!id) {
    return null;
  }
  const title = typeof row?.title === "string" ? row.title : "Event";
  const slug = typeof row?.slug === "string" ? row.slug : null;
  return {
    id: `event-insert-${id}`,
    message: slug ? `New event — ${title} (/e/${slug})` : `New event — ${title}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function feedItemFromMatchRunChange(
  payload: RealtimePostgresChangesPayload<Row>,
): AdminLiveFeedItem | null {
  if (payload.eventType !== "INSERT") {
    return null;
  }
  const row = payload.new;
  const id = rowId(row);
  if (!id) {
    return null;
  }
  const matched = typeof row.matched_count === "number" ? row.matched_count : null;
  const detail = matched !== null ? ` — ${matched} match${matched === 1 ? "" : "es"}` : "";
  return {
    id: `match-${id}`,
    message: `Guest search completed${detail}`,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}
