export const MAX_DEMO_GALLERY_PHOTOS = 50;

export function countGalleryUrls(urlsText: string): number {
  return urlsText.split("\n").filter((line) => line.trim()).length;
}

export function remainingGallerySlots(
  fileCount: number,
  urlsText: string,
  maxPhotos: number,
): number {
  return Math.max(0, maxPhotos - fileCount - countGalleryUrls(urlsText));
}

export function trimUrlsText(urlsText: string, maxUrls: number): string {
  if (maxUrls <= 0) {
    return urlsText
      .split("\n")
      .map((line) => (line.trim() ? "" : line))
      .join("\n");
  }

  let urlCount = 0;
  return urlsText
    .split("\n")
    .map((line) => {
      if (!line.trim()) {
        return line;
      }
      if (urlCount >= maxUrls) {
        return "";
      }
      urlCount += 1;
      return line;
    })
    .join("\n");
}
