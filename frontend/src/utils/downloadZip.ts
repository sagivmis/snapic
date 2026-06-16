import type { AuthFetchOptions } from "../api/client";
import { fetchEventGalleryPhotoImage } from "../api/client";
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read image"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
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

export async function resolveFullImageData(
  photo: MatchedPhoto,
  options?: { eventId?: string | null; auth?: AuthFetchOptions },
): Promise<{ base64: string; mime: string }> {
  if (photo.image_base64) {
    return {
      base64: photo.image_base64,
      mime: photo.image_mime ?? "image/jpeg",
    };
  }

  if (options?.eventId && photo.gallery_photo_id) {
    const meta = await fetchEventGalleryPhotoImage(
      options.eventId,
      photo.gallery_photo_id,
      options.auth ?? {},
    );
    const imageResponse = await fetch(meta.signed_url);
    if (!imageResponse.ok) {
      throw new Error("Could not download photo");
    }
    const blob = await imageResponse.blob();
    return {
      base64: await blobToBase64(blob),
      mime: meta.mime_type || blob.type || "image/jpeg",
    };
  }

  return getFullImageData(photo);
}

export interface DownloadZipOptions {
  eventId?: string | null;
  auth?: AuthFetchOptions;
}

export async function downloadMatchesAsZip(
  matched: MatchedPhoto[],
  archiveName = "snapic-wedding-photos",
  options?: DownloadZipOptions,
): Promise<void> {
  if (matched.length === 0) {
    return;
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  const resolved = await Promise.all(
    matched.map(async (item, index) => {
      const { base64, mime } = await resolveFullImageData(item, options);
      const filename = sanitizeFilename(item.filename ?? `match-${index + 1}.jpg`, index, mime);
      return { filename, base64 };
    }),
  );

  resolved.forEach(({ filename, base64 }) => {
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
