import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createTranslator } from "../i18n";

export interface AdminLiveFeedItem {
  id: string;
  message: string;
  createdAt: string;
}

type Row = Record<string, unknown>;

const { tPath } = createTranslator("admin.liveFeed.messages");

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
      return couple ? tPath("signupApproved", { couple }) : tPath("signupApprovedGeneric");
    case "signup.reject":
      return couple ? tPath("signupRejected", { couple }) : tPath("signupRejectedGeneric");
    case "event.create":
      return title
        ? tPath("eventCreated", { title })
        : slug
          ? tPath("eventCreatedSlug", { slug })
          : tPath("eventCreatedGeneric");
    case "event.update":
      return title
        ? tPath("eventUpdated", { title })
        : slug
          ? tPath("eventUpdatedSlug", { slug })
          : tPath("eventUpdatedGeneric");
    case "event.delete":
      return title
        ? tPath("eventDeleted", { title })
        : slug
          ? tPath("eventDeletedSlug", { slug })
          : tPath("eventDeletedGeneric");
    case "event.invite":
      return email ? tPath("inviteSent", { email }) : tPath("inviteSentGeneric");
    case "sentry_test":
      return tPath("sentryTest");
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
    message: tPath("newSignup", {
      couple,
      emailPart: email ? tPath("newSignupEmailPart", { email }) : "",
    }),
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
    message: slug ? tPath("newEvent", { title, slug }) : tPath("newEventNoSlug", { title }),
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
  if (matched === null) {
    return {
      id: `match-${id}`,
      message: tPath("guestSearchCompleted"),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    };
  }
  return {
    id: `match-${id}`,
    message:
      matched === 1
        ? tPath("guestSearchCompletedMatches", { count: matched })
        : tPath("guestSearchCompletedMatchesPlural", { count: matched }),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}
