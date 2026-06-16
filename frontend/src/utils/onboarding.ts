export type SetupStep = "welcome" | "branding" | "invite" | "ready";

export const SETUP_STEPS: SetupStep[] = ["welcome", "branding", "invite", "ready"];

export function parseSetupStep(value: unknown): SetupStep | null {
  if (value === "welcome" || value === "branding" || value === "invite" || value === "ready") {
    return value;
  }
  return null;
}

export function slugifyEventName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "event";
}

export function defaultEventTitle(coupleNames: string): string {
  const trimmed = coupleNames.trim();
  if (!trimmed) {
    return "Wedding Gallery";
  }
  return trimmed.endsWith("Wedding") ? trimmed : `${trimmed} Wedding`;
}

export type SetupAction = "upload" | "index" | "activate" | "complete";

export interface SetupActionState {
  action: SetupAction;
  label: string;
  busyLabel: string;
}

export function getNextSetupAction(status: {
  has_photos: boolean;
  faces_indexed: boolean;
  is_active: boolean;
}): SetupActionState {
  if (!status.has_photos) {
    return { action: "upload", label: "Upload images", busyLabel: "Opening album…" };
  }
  if (!status.faces_indexed) {
    return { action: "index", label: "Index faces", busyLabel: "Indexing faces…" };
  }
  if (!status.is_active) {
    return { action: "activate", label: "Set event to Active", busyLabel: "Going live…" };
  }
  return { action: "complete", label: "Finish setup", busyLabel: "Finishing…" };
}
