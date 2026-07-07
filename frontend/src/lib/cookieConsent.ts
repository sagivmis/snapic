const CONSENT_KEY = "snapic_cookie_consent";

export type CookieConsentChoice = "accepted" | "declined";

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    if (value === "accepted" || value === "declined") {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCookieConsent(choice: CookieConsentChoice): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* ignore */
  }
}
