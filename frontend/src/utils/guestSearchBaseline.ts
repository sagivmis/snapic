import type { MatchRunSummary } from "../types";

function storageKey(eventId: string): string {
  return `snapic-gallery-at-last-search-${eventId}`;
}

/** Persist gallery size at last successful search (anonymous fallback). */
export function recordGalleryAtSearch(eventId: string, totalGallery: number): void {
  if (totalGallery <= 0) {
    return;
  }
  try {
    localStorage.setItem(storageKey(eventId), String(totalGallery));
  } catch {
    // Private browsing / storage full
  }
}

/** Gallery photo count when this guest last searched. */
export function galleryAtLastSearch(eventId: string, runs: MatchRunSummary[]): number {
  const fromRun = runs[0]?.total_gallery;
  if (typeof fromRun === "number" && fromRun > 0) {
    return fromRun;
  }
  try {
    const stored = localStorage.getItem(storageKey(eventId));
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

export function hasNewPhotosSinceLastSearch(
  currentCount: number,
  eventId: string,
  runs: MatchRunSummary[],
): boolean {
  const baseline = galleryAtLastSearch(eventId, runs);
  return baseline > 0 && currentCount > baseline;
}

export function countNewPhotosSinceLastSearch(
  currentCount: number,
  eventId: string,
  runs: MatchRunSummary[],
): number {
  const baseline = galleryAtLastSearch(eventId, runs);
  if (baseline <= 0) {
    return 0;
  }
  return Math.max(0, currentCount - baseline);
}
