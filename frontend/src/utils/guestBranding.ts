import type { CSSProperties } from "react";

export const DECORATION_THEMES = ["none", "classic", "floral", "hearts", "elegant"] as const;

export type DecorationTheme = (typeof DECORATION_THEMES)[number];

export interface ParsedGuestBranding {
  coupleNames: string | null;
  accent: string | null;
  welcomeMessage: string | null;
  decorationTheme: DecorationTheme;
}

function isDecorationTheme(value: string): value is DecorationTheme {
  return DECORATION_THEMES.includes(value as DecorationTheme);
}

export function parseGuestBranding(branding: Record<string, unknown> | undefined): ParsedGuestBranding {
  const b = branding ?? {};
  const themeRaw = typeof b.decoration_theme === "string" ? b.decoration_theme : "classic";
  const decorationTheme = isDecorationTheme(themeRaw) ? themeRaw : "classic";

  return {
    coupleNames: typeof b.couple_names === "string" && b.couple_names.trim() ? b.couple_names.trim() : null,
    accent: typeof b.accent_color === "string" && b.accent_color.trim() ? b.accent_color.trim() : null,
    welcomeMessage:
      typeof b.welcome_message === "string" && b.welcome_message.trim() ? b.welcome_message.trim() : null,
    decorationTheme,
  };
}

export function guestDisplayTitle(
  branding: ParsedGuestBranding,
  eventTitle: string,
  fallback = "Your gallery",
): string {
  return branding.coupleNames ?? eventTitle ?? fallback;
}

export function guestPageRootStyle(accent: string | null): CSSProperties | undefined {
  if (!accent) {
    return undefined;
  }
  return { "--event-accent": accent } as CSSProperties;
}

export function guestPageRootClassName(
  decorationTheme: DecorationTheme,
  themed: boolean,
  extra?: string,
): string {
  const classes = ["event-guest"];
  if (extra) {
    classes.push(extra);
  }
  if (themed) {
    classes.push("event-guest--themed");
  }
  if (decorationTheme !== "none") {
    classes.push(`event-guest--decoration-${decorationTheme}`);
  }
  return classes.join(" ");
}
