export const LAUNCH_PROMO_CODE = "LAUNCH30";
export const LAUNCH_DISCOUNT_PERCENT = 30;
/** ISO date when the public launch discount expires (local midnight Israel). */
export const LAUNCH_OFFER_END_ISO = "2026-08-31T23:59:59+03:00";

export function launchOfferActive(now = Date.now()): boolean {
  return now < Date.parse(LAUNCH_OFFER_END_ISO);
}

export function launchCountdownParts(now = Date.now()): {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
} {
  const end = Date.parse(LAUNCH_OFFER_END_ISO);
  const remaining = Math.max(0, end - now);
  if (remaining === 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return { days, hours, minutes, expired: false };
}
