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
