import { apiUrl } from "./config";
import type {
  AdminEventSummary,
  AdminStats,
  EventCreateRequest,
  EventPublic,
  EventStats,
  EventUpdateRequest,
  GalleryPhoto,
  MatchRequest,
  MatchResponse,
  MatchRunSummary,
  MatchedPhoto,
  PortraitQualityResponse,
  SignupRequest,
  SignupRequestCreate,
  UserEventSummary,
} from "../types";

export interface AuthFetchOptions {
  token?: string | null;
  anonymousSessionId?: string | null;
}

async function authFetch(
  path: string,
  init: RequestInit = {},
  auth: AuthFetchOptions = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (auth.token) {
    headers.set("Authorization", `Bearer ${auth.token}`);
  }
  if (auth.anonymousSessionId) {
    headers.set("X-Anonymous-Session-Id", auth.anonymousSessionId);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => null);
  const detail =
    payload && typeof payload.detail === "string" ? payload.detail : fallback;
  throw new Error(detail);
}

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

  const response = await fetch(apiUrl("/api/match"), { method: "POST", body: formData });
  if (!response.ok) {
    await parseError(response, "Failed to match photos");
  }
  return response.json() as Promise<MatchResponse>;
}

export async function matchEventPhotos(
  eventId: string,
  request: Omit<MatchRequest, "galleryFiles" | "galleryUrls">,
  auth: AuthFetchOptions,
): Promise<MatchResponse> {
  const formData = new FormData();
  formData.append("selfie", request.selfie);
  formData.append("threshold", String(request.threshold));
  if (request.partnerSelfie) {
    formData.append("partner_selfie", request.partnerSelfie);
  }

  const response = await authFetch(
    `/api/events/${eventId}/match`,
    { method: "POST", body: formData },
    auth,
  );
  if (!response.ok) {
    await parseError(response, "Failed to match photos");
  }
  return response.json() as Promise<MatchResponse>;
}

export interface GalleryPhotoImageResponse {
  signed_url: string;
  mime_type: string;
  filename?: string | null;
}

export async function fetchEventGalleryPhotoImage(
  eventId: string,
  photoId: string,
  auth: AuthFetchOptions = {},
): Promise<GalleryPhotoImageResponse> {
  const response = await authFetch(`/api/events/${eventId}/gallery/${photoId}/image`, {}, auth);
  if (!response.ok) {
    await parseError(response, "Could not load photo");
  }
  return response.json() as Promise<GalleryPhotoImageResponse>;
}

export type MatchStreamEvent =
  | { type: "progress"; processed: number; total: number; matched_count: number }
  | { type: "match"; photo: MatchedPhoto }
  | { type: "complete"; result: MatchResponse }
  | { type: "error"; message: string };

export async function matchEventPhotosStream(
  eventId: string,
  request: Omit<MatchRequest, "galleryFiles" | "galleryUrls">,
  auth: AuthFetchOptions,
  onEvent: (event: MatchStreamEvent) => void,
): Promise<MatchResponse> {
  const formData = new FormData();
  formData.append("selfie", request.selfie);
  formData.append("threshold", String(request.threshold));
  if (request.partnerSelfie) {
    formData.append("partner_selfie", request.partnerSelfie);
  }

  const response = await authFetch(
    `/api/events/${eventId}/match/stream`,
    { method: "POST", body: formData },
    auth,
  );
  if (response.status === 404) {
    const result = await matchEventPhotos(eventId, request, auth);
    onEvent({
      type: "progress",
      processed: result.total_gallery,
      total: result.total_gallery,
      matched_count: result.matched.length,
    });
    for (const photo of result.matched) {
      onEvent({ type: "match", photo });
    }
    onEvent({ type: "complete", result });
    return result;
  }
  if (!response.ok) {
    await parseError(response, "Failed to match photos");
  }
  if (!response.body) {
    throw new Error("Match stream unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: MatchResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const event = JSON.parse(line) as MatchStreamEvent;
      if (event.type === "error") {
        throw new Error(event.message);
      }
      onEvent(event);
      if (event.type === "complete") {
        finalResult = event.result;
      }
    }
  }

  if (!finalResult) {
    throw new Error("Match ended before completion");
  }
  return finalResult;
}

export async function fetchEventBySlug(
  slug: string,
  token?: string | null,
): Promise<EventPublic> {
  const response = await authFetch(`/api/events/by-slug/${slug}`, {}, { token });
  if (!response.ok) {
    await parseError(response, "Event not found");
  }
  return response.json() as Promise<EventPublic>;
}

export async function fetchEventGallery(eventId: string, token?: string | null): Promise<GalleryPhoto[]> {
  const response = await authFetch(`/api/events/${eventId}/gallery`, {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load gallery");
  }
  return response.json() as Promise<GalleryPhoto[]>;
}

export async function uploadEventGalleryPhoto(
  eventId: string,
  file: File,
  token: string,
  onProgress?: (loaded: number, total: number) => void,
  section?: string,
): Promise<GalleryPhoto> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (section) {
      formData.append("section", section);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(`/api/events/${eventId}/gallery`));
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as GalleryPhoto);
        } catch {
          reject(new Error("Upload failed"));
        }
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { detail?: string };
        reject(new Error(payload.detail ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.send(formData);
  });
}

export async function deleteEventGalleryPhoto(
  eventId: string,
  photoId: string,
  token: string,
): Promise<void> {
  const response = await authFetch(
    `/api/events/${eventId}/gallery/${photoId}`,
    { method: "DELETE" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Delete failed");
  }
}

export async function bulkDeleteEventGalleryPhotos(
  eventId: string,
  photoIds: string[],
  token: string,
): Promise<{ deleted: number; not_found: number }> {
  const response = await authFetch(
    `/api/events/${eventId}/gallery/bulk-delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_ids: photoIds }),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Bulk delete failed");
  }
  return response.json() as Promise<{ deleted: number; not_found: number }>;
}

export async function updateEvent(
  eventId: string,
  body: EventUpdateRequest,
  token: string,
): Promise<EventPublic> {
  const response = await authFetch(
    `/api/events/${eventId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Update failed");
  }
  return response.json() as Promise<EventPublic>;
}

export async function validatePortrait(portrait: File): Promise<PortraitQualityResponse> {
  const formData = new FormData();
  formData.append("portrait", portrait);
  const response = await fetch(apiUrl("/api/validate-portrait"), { method: "POST", body: formData });
  if (!response.ok) {
    await parseError(response, "Could not validate portrait");
  }
  return response.json() as Promise<PortraitQualityResponse>;
}

export async function fetchSharedResults(shareId: string): Promise<MatchResponse> {
  const response = await fetch(apiUrl(`/api/share/${shareId}`));
  if (!response.ok) {
    await parseError(response, "Shared results not found");
  }
  return response.json() as Promise<MatchResponse>;
}

export async function submitSignupRequest(body: SignupRequestCreate): Promise<SignupRequest> {
  const response = await fetch(apiUrl("/api/signup-requests"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await parseError(response, "Could not submit request");
  }
  return response.json() as Promise<SignupRequest>;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const response = await authFetch("/api/admin/stats", {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load stats");
  }
  return response.json() as Promise<AdminStats>;
}

export async function fetchAdminEvents(token: string): Promise<AdminEventSummary[]> {
  const response = await authFetch("/api/admin/events", {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load events");
  }
  return response.json() as Promise<AdminEventSummary[]>;
}

export async function updateAdminEvent(
  eventId: string,
  body: EventUpdateRequest,
  token: string,
): Promise<AdminEventSummary> {
  const response = await authFetch(
    `/api/admin/events/${eventId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Could not update event");
  }
  return response.json() as Promise<AdminEventSummary>;
}

export async function createAdminEvent(body: EventCreateRequest, token: string): Promise<EventPublic> {
  const response = await authFetch(
    "/api/admin/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Could not create event");
  }
  return response.json() as Promise<EventPublic>;
}

export async function fetchSignupRequests(token: string): Promise<SignupRequest[]> {
  const response = await authFetch("/api/admin/signup-requests", {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load requests");
  }
  return response.json() as Promise<SignupRequest[]>;
}

export async function reviewSignupRequest(
  requestId: string,
  action: "approve" | "reject",
  token: string,
  extra?: { slug?: string; title?: string; event_id?: string },
): Promise<SignupRequest> {
  const response = await authFetch(
    `/api/admin/signup-requests/${requestId}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Review failed");
  }
  return response.json() as Promise<SignupRequest>;
}

export async function reindexEventGallery(eventId: string, token: string): Promise<{ processed: number }> {
  const response = await authFetch(
    `/api/events/${eventId}/gallery/index-faces`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Could not index album faces");
  }
  return response.json() as Promise<{ processed: number }>;
}

export function buildShareUrl(shareId: string): string {
  return `${window.location.origin}/share/${shareId}`;
}

export function buildEventGuestUrl(slug: string): string {
  return `${window.location.origin}/e/${slug}`;
}

export async function inviteEventMember(
  eventId: string,
  email: string,
  token: string,
  role: "admin" | "co_admin" = "co_admin",
): Promise<void> {
  const params = new URLSearchParams({ email, role });
  const response = await authFetch(
    `/api/events/${eventId}/members?${params}`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Could not invite member");
  }
}

export async function fetchEventGallerySections(eventId: string, token: string): Promise<string[]> {
  const response = await authFetch(`/api/events/${eventId}/gallery/sections`, {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load sections");
  }
  return response.json() as Promise<string[]>;
}

export async function updateGalleryPhotoSection(
  eventId: string,
  photoId: string,
  section: string,
  token: string,
): Promise<GalleryPhoto> {
  const response = await authFetch(
    `/api/events/${eventId}/gallery/${photoId}/section`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section }),
    },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "Could not update section");
  }
  return response.json() as Promise<GalleryPhoto>;
}

export async function fetchEventStats(eventId: string, token: string): Promise<EventStats> {
  const response = await authFetch(`/api/events/${eventId}/stats`, {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load stats");
  }
  return response.json() as Promise<EventStats>;
}

export async function fetchMyEvents(token: string): Promise<UserEventSummary[]> {
  const response = await authFetch("/api/events/mine", {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load your events");
  }
  return response.json() as Promise<UserEventSummary[]>;
}

export async function fetchMyEventRuns(
  eventId: string,
  auth: AuthFetchOptions,
): Promise<MatchRunSummary[]> {
  const response = await authFetch(`/api/events/${eventId}/my-runs`, {}, auth);
  if (!response.ok) {
    await parseError(response, "Could not load past searches");
  }
  return response.json() as Promise<MatchRunSummary[]>;
}

export async function downloadEventGalleryZip(eventId: string, token: string, filename: string): Promise<void> {
  const response = await authFetch(`/api/events/${eventId}/gallery/download`, {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not download album");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
