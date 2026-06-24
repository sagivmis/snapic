import { createTranslator } from "../i18n";

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

export const MIN_EVENT_SLUG_LENGTH = 2;

export function isEventSlugLongEnough(slug: string): boolean {
  return slug.trim().length >= MIN_EVENT_SLUG_LENGTH;
}

export function defaultEventTitle(coupleNames: string): string {
  const { tPath } = createTranslator("events.common");
  const trimmed = coupleNames.trim();
  if (!trimmed) {
    return tPath("defaultEventTitle");
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
  const setup = createTranslator("events.setup");
  const manage = createTranslator("events.manage");
  const { t } = createTranslator();

  if (!status.has_photos) {
    return {
      action: "upload",
      label: setup.tPath("checklistUpload"),
      busyLabel: manage.tPath("loadingAlbum"),
    };
  }
  if (!status.faces_indexed) {
    return {
      action: "index",
      label: manage.tPath("indexFaces"),
      busyLabel: setup.tPath("checklistIndexing"),
    };
  }
  if (!status.is_active) {
    return {
      action: "activate",
      label: setup.tPath("checklistActivate"),
      busyLabel: t("creating"),
    };
  }
  return {
    action: "complete",
    label: t("continue"),
    busyLabel: setup.tPath("saving"),
  };
}
