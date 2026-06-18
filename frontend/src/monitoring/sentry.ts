import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== "string" || !dsn.trim()) {
    return;
  }

  Sentry.init({
    dsn: dsn.trim(),
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export function isSentryConfigured(): boolean {
  return Boolean(Sentry.getClient());
}

/** Send a one-off test event (super-admin monitoring check). */
export function captureSentryTestEvent(): boolean {
  if (!isSentryConfigured()) {
    return false;
  }
  Sentry.captureMessage("Snapic admin Sentry test (frontend)", {
    level: "info",
    tags: { source: "admin_test" },
  });
  return true;
}

export { Sentry };
