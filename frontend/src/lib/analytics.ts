/**
 * Lightweight analytics wrapper. Today this only logs to the console (gated by
 * the `?debug=1` query param to keep production noise low) so we can measure
 * whether UX changes reduce "where do I go" confusion without committing to a
 * specific provider yet. Replace the inner body with PostHog / Segment / etc.
 * when ready.
 */
export type AnalyticsEvent =
  | "landing_chooser_clicked"
  | "landing_continue_clicked"
  | "couple_home_next_step_clicked"
  | "couple_home_preview_opened"
  | "couple_home_share_opened"
  | "couple_home_help_opened"
  | "couple_home_branding_saved"
  | "couple_home_coadmin_invited"
  | "couple_home_indexed"
  | "couple_home_went_live"
  | "couple_home_onboarding_completed"
  | "request_access_submitted";

const DEBUG_KEY = "snapic_analytics_debug";

function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.search.includes("debug=1")) {
      window.localStorage.setItem(DEBUG_KEY, "1");
    }
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function track(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (isDebug()) {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, properties);
  }
  // Hook for future providers, e.g.:
  //   window.posthog?.capture(event, properties);
}
