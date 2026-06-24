import { fetchEventAlbumStatus, fetchStudioClient } from "../api/client";
import type { EventPublic } from "../types";

/**
 * Whether the signed-in user can manage this event (album, settings, etc.).
 * Uses API flags when present, with fallbacks for studio org events before backend deploy.
 */
export async function canManageEvent(
  event: EventPublic,
  token: string,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin || event.is_admin === true) {
    return true;
  }

  // Draft events are only returned by /by-slug to event admins.
  if (event.status === "draft") {
    return true;
  }

  if (event.organization_id) {
    try {
      await fetchStudioClient(event.id, token);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await fetchEventAlbumStatus(event.id, token);
    return true;
  } catch {
    return false;
  }
}
