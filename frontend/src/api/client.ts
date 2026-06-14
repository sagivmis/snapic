import { apiUrl } from "./config";
import type { MatchRequest, MatchResponse, PortraitQualityResponse } from "../types";

export async function matchPhotos(request: MatchRequest): Promise<MatchResponse> {
  const formData = new FormData();
  formData.append("selfie", request.selfie);
  formData.append("threshold", String(request.threshold));

  if (request.partnerSelfie) {
    formData.append("partner_selfie", request.partnerSelfie);
  }

  for (const file of request.galleryFiles) {
    formData.append("gallery_files", file);
  }

  if (request.galleryUrls.length > 0) {
    formData.append("gallery_urls", JSON.stringify(request.galleryUrls));
  }

  const response = await fetch(apiUrl("/api/match"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Failed to match photos";
    throw new Error(detail);
  }

  return response.json() as Promise<MatchResponse>;
}

export async function validatePortrait(portrait: File): Promise<PortraitQualityResponse> {
  const formData = new FormData();
  formData.append("portrait", portrait);

  const response = await fetch(apiUrl("/api/validate-portrait"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Could not validate portrait";
    throw new Error(detail);
  }

  return response.json() as Promise<PortraitQualityResponse>;
}

export async function fetchSharedResults(shareId: string): Promise<MatchResponse> {
  const response = await fetch(apiUrl(`/api/share/${shareId}`));

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Shared results not found";
    throw new Error(detail);
  }

  return response.json() as Promise<MatchResponse>;
}

export function buildShareUrl(shareId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("share", shareId);
  return url.toString();
}
