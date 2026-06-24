/** Heuristic device hints for upload copy — not used for security. */

import { createTranslator } from "../i18n";

export function isIos(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const touch = navigator.maxTouchPoints > 0;
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  return touch && (narrow || isIos() || /Android/i.test(navigator.userAgent));
}

export function isDesktopUpload(): boolean {
  return !isMobileDevice();
}

export const MOBILE_BATCH_RECOMMENDED = 30;

const albumUpload = createTranslator("components.albumUpload");

export function mobileUploadHint(): string {
  return albumUpload.tPath("mobileHint", { batch: MOBILE_BATCH_RECOMMENDED });
}

export function desktopUploadHint(): string {
  return albumUpload.tPath("desktopHint");
}
