import { apiUrl } from "./config";
import type {
  AdminStats,
  EventCreateRequest,
  EventPublic,
  EventUpdateRequest,
  GalleryPhoto,
  MatchRequest,
  MatchResponse,
  PortraitQualityResponse,
  SignupRequest,
  SignupRequestCreate,
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
): Promise<GalleryPhoto> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

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

export async function fetchAdminEvents(token: string): Promise<EventPublic[]> {
  const response = await authFetch("/api/admin/events", {}, { token });
  if (!response.ok) {
    await parseError(response, "Could not load events");
  }
  return response.json() as Promise<EventPublic[]>;
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
  extra?: { slug?: string; title?: string },
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
