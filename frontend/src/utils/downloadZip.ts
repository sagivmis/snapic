import type { MatchedPhoto } from "../types";

function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function sanitizeFilename(name: string, index: number, mime: string): string {
  const ext = extensionFromMime(mime);
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${String(index + 1).padStart(2, "0")}-${base || "photo"}.${ext}`;
}

export function getFullImageData(photo: MatchedPhoto): { base64: string; mime: string } {
  return {
    base64: photo.image_base64 ?? photo.preview_base64,
    mime: photo.image_mime ?? "image/jpeg",
  };
}

export function getImageDataUrl(photo: MatchedPhoto): string {
  const { base64, mime } = getFullImageData(photo);
  return `data:${mime};base64,${base64}`;
}

export async function downloadMatchesAsZip(
  matched: MatchedPhoto[],
  archiveName = "snapic-wedding-photos",
): Promise<void> {
  if (matched.length === 0) {
    return;
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  matched.forEach((item, index) => {
    const { base64, mime } = getFullImageData(item);
    const filename = sanitizeFilename(item.filename ?? `match-${index + 1}.jpg`, index, mime);
    zip.file(filename, base64, { base64: true });
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${archiveName}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
