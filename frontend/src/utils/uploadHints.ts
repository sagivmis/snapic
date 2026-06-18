/** Heuristic device hints for upload copy — not used for security. */

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

export function mobileUploadHint(): string {
  return `On iPhone, add about ${MOBILE_BATCH_RECOMMENDED} photos at a time for fastest selection. You can tap Add photos again while uploads continue.`;
}

export function desktopUploadHint(): string {
  return "Drag a folder from your computer, or choose a folder — best for large albums from your photographer.";
}
