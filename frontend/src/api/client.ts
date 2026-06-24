import { createTranslator } from "../i18n";
import { apiUrl } from "./config";
import { getStoredStudioOrgId } from "../lib/studioOrg";

const { tPath: apiError } = createTranslator("errors.api");
import type {
  AdminAttention,
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
  EventSetupStatus,
  EventAlbumStatus,
  IndexScope,
  SlugCheckResult,
  Organization,
  StudioBilling,
  StudioClient,
  StudioStats,
  AdminOrganization,
  AuditLogEntry,
  SentryTestResult,
} from "../types";

export interface AuthFetchOptions {
  token?: string | null;
  anonymousSessionId?: string | null;
  studioOrgId?: string | null;
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
  if (auth.studioOrgId) {
    headers.set("X-Studio-Org-Id", auth.studioOrgId);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

function studioAuth(token: string, orgId?: string | null): AuthFetchOptions {
  return {
    token,
    studioOrgId: orgId === undefined ? getStoredStudioOrgId() : orgId,
  };
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload.detail === "string") {
    throw new ApiError(payload.detail, response.status);
  }
  if (payload && Array.isArray(payload.detail)) {
    const message = payload.detail
      .map((item: { msg?: string; loc?: unknown[] }) => {
        const loc = Array.isArray(item.loc) ? item.loc : [];
        const field = loc.length > 0 ? loc[loc.length - 1] : null;
        return field ? `${String(field)}: ${item.msg ?? "invalid"}` : item.msg;
      })
      .filter(Boolean)
      .join("; ");
    if (message) {
      throw new ApiError(message, response.status);
    }
  }
  throw new ApiError(apiError(fallback), response.status);
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
    await parseError(response, "matchPhotos");
  }
  return response.json() as Promise<MatchResponse>;
}

export async function matchPhotosStream(
  request: MatchRequest,
  onEvent: (event: MatchStreamEvent) => void,
): Promise<MatchResponse> {
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

  const response = await fetch(apiUrl("/api/match/stream"), { method: "POST", body: formData });
  if (response.status === 404) {
    const result = await matchPhotos(request);
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
    await parseError(response, "matchPhotos");
  }
  if (!response.body) {
    throw new Error(apiError("matchStreamUnavailable"));
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
    throw new Error(apiError("matchEndedEarly"));
  }
  return finalResult;
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
    await parseError(response, "matchPhotos");
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
    await parseError(response, "loadPhoto");
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
    await parseError(response, "matchPhotos");
  }
  if (!response.body) {
    throw new Error(apiError("matchStreamUnavailable"));
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
    throw new Error(apiError("matchEndedEarly"));
  }
  return finalResult;
}

export async function fetchEventBySlug(
  slug: string,
  token?: string | null,
): Promise<EventPublic> {
  const response = await authFetch(`/api/events/by-slug/${slug}`, { cache: "no-store" }, { token });
  if (!response.ok) {
    await parseError(response, "eventNotFound");
  }
  return response.json() as Promise<EventPublic>;
}

export async function fetchEventGallery(
  eventId: string,
  token?: string | null,
  options?: { includeUrls?: boolean },
): Promise<GalleryPhoto[]> {
  const params = new URLSearchParams();
  if (options?.includeUrls) {
    params.set("include_urls", "true");
  }
  const query = params.toString();
  const response = await authFetch(
    `/api/events/${eventId}/gallery${query ? `?${query}` : ""}`,
    {},
    { token },
  );
  if (!response.ok) {
    await parseError(response, "loadGallery");
  }
  return response.json() as Promise<GalleryPhoto[]>;
}

export async function fetchGalleryPreviewUrls(
  eventId: string,
  token: string,
  offset: number,
  limit = 48,
): Promise<{ urls: Record<string, string>; offset: number; limit: number; total: number }> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  const response = await authFetch(
    `/api/events/${eventId}/gallery/preview-urls?${params}`,
    {},
    { token },
  );
  if (!response.ok) {
    await parseError(response, "loadPhotoPreviews");
  }
  return response.json() as Promise<{
    urls: Record<string, string>;
    offset: number;
    limit: number;
    total: number;
  }>;
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
          reject(new Error(apiError("uploadFailed")));
        }
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { detail?: string };
        reject(new Error(payload.detail ?? apiError("uploadFailed")));
      } catch {
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error(apiError("uploadFailed"))));
    xhr.addEventListener("abort", () => reject(new Error(apiError("uploadCancelled"))));
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
    await parseError(response, "deleteFailed");
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
    await parseError(response, "bulkDeleteFailed");
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
    await parseError(response, "updateFailed");
  }
  return response.json() as Promise<EventPublic>;
}

export async function validatePortrait(portrait: File): Promise<PortraitQualityResponse> {
  const formData = new FormData();
  formData.append("portrait", portrait);
  const response = await fetch(apiUrl("/api/validate-portrait"), { method: "POST", body: formData });
  if (!response.ok) {
    await parseError(response, "validatePortrait");
  }
  return response.json() as Promise<PortraitQualityResponse>;
}

export async function fetchSharedResults(shareId: string): Promise<MatchResponse> {
  const response = await fetch(apiUrl(`/api/share/${shareId}`));
  if (!response.ok) {
    await parseError(response, "sharedResultsNotFound");
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
    await parseError(response, "submitRequest");
  }
  return response.json() as Promise<SignupRequest>;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  const response = await authFetch("/api/admin/stats", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadStats");
  }
  return response.json() as Promise<AdminStats>;
}

export async function fetchAdminAttention(token: string): Promise<AdminAttention> {
  const response = await authFetch("/api/admin/attention", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadAttention");
  }
  return response.json() as Promise<AdminAttention>;
}

export async function fetchAdminEvents(token: string): Promise<AdminEventSummary[]> {
  const response = await authFetch("/api/admin/events", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadEvents");
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
    await parseError(response, "updateEvent");
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
    await parseError(response, "createEvent");
  }
  return response.json() as Promise<EventPublic>;
}

export async function deleteAdminEvent(eventId: string, token: string): Promise<void> {
  const response = await authFetch(`/api/admin/events/${eventId}`, { method: "DELETE" }, { token });
  if (!response.ok) {
    await parseError(response, "deleteEvent");
  }
}

export async function inviteAdminEventMember(
  eventId: string,
  email: string,
  token: string,
  role: "admin" | "co_admin" = "admin",
): Promise<void> {
  const params = new URLSearchParams({ email, role });
  const response = await authFetch(
    `/api/admin/events/${eventId}/members?${params}`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "inviteAdmin");
  }
}

export async function fetchSignupRequests(token: string): Promise<SignupRequest[]> {
  const response = await authFetch("/api/admin/signup-requests", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadRequests");
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
    await parseError(response, "reviewFailed");
  }
  return response.json() as Promise<SignupRequest>;
}

export type IndexStreamEvent =
  | {
      type: "progress";
      processed: number;
      total: number;
      indexed: number;
      no_face: number;
      failed: number;
      thumbs_backfilled: number;
    }
  | {
      type: "complete";
      processed: number;
      indexed: number;
      no_face: number;
      failed: number;
      thumbs_backfilled: number;
    }
  | { type: "error"; message: string };

export async function fetchEventAlbumStatus(
  eventId: string,
  token: string,
): Promise<EventAlbumStatus> {
  const response = await authFetch(`/api/events/${eventId}/album-status`, {}, { token });
  if (!response.ok) {
    await parseError(response, "loadAlbumStatus");
  }
  return response.json() as Promise<EventAlbumStatus>;
}

export async function reindexEventGalleryStream(
  eventId: string,
  token: string,
  onEvent: (event: IndexStreamEvent) => void,
  scope: IndexScope = "all",
): Promise<Extract<IndexStreamEvent, { type: "complete" }>> {
  const params = new URLSearchParams({ scope });
  const response = await authFetch(
    `/api/events/${eventId}/gallery/index-faces/stream?${params}`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "indexAlbumFaces");
  }
  if (!response.body) {
    throw new Error(apiError("indexingStreamUnavailable"));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: Extract<IndexStreamEvent, { type: "complete" }> | null = null;

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
      const event = JSON.parse(line) as IndexStreamEvent;
      if (event.type === "error") {
        throw new Error(event.message);
      }
      onEvent(event);
      if (event.type === "complete") {
        finalResult = event;
      }
    }
  }

  if (!finalResult) {
    throw new Error(apiError("indexingEndedEarly"));
  }
  return finalResult;
}

export async function reindexEventGallery(
  eventId: string,
  token: string,
  onProgress?: (event: Extract<IndexStreamEvent, { type: "progress" }>) => void,
  scope: IndexScope = "all",
): Promise<{
  processed: number;
  indexed: number;
  no_face: number;
  failed: number;
  thumbs_backfilled: number;
}> {
  if (onProgress) {
    return reindexEventGalleryStream(eventId, token, (event) => {
      if (event.type === "progress") {
        onProgress(event);
      }
    }, scope);
  }
  const params = new URLSearchParams({ scope });
  const response = await authFetch(
    `/api/events/${eventId}/gallery/index-faces?${params}`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "indexAlbumFaces");
  }
  return response.json() as Promise<{
    processed: number;
    indexed: number;
    no_face: number;
    failed: number;
    thumbs_backfilled: number;
  }>;
}

export async function checkAdminSlug(slug: string, token: string): Promise<SlugCheckResult> {
  const params = new URLSearchParams({ slug });
  const response = await authFetch(`/api/admin/slug-check?${params}`, {}, { token });
  if (!response.ok) {
    await parseError(response, "checkSlug");
  }
  return response.json() as Promise<SlugCheckResult>;
}

export async function fetchAdminAuditLog(token: string, limit = 50): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await authFetch(`/api/admin/audit-log?${params}`, {}, { token });
  if (!response.ok) {
    await parseError(response, "loadAuditLog");
  }
  return response.json() as Promise<AuditLogEntry[]>;
}

export async function testAdminSentry(token: string): Promise<SentryTestResult> {
  const response = await authFetch(
    "/api/admin/monitoring/sentry-test",
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "sentryTest");
  }
  return response.json() as Promise<SentryTestResult>;
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
    await parseError(response, "inviteMember");
  }
}

export async function fetchEventGallerySections(eventId: string, token: string): Promise<string[]> {
  const response = await authFetch(`/api/events/${eventId}/gallery/sections`, {}, { token });
  if (!response.ok) {
    await parseError(response, "loadSections");
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
    await parseError(response, "updateSection");
  }
  return response.json() as Promise<GalleryPhoto>;
}

export async function fetchEventStats(eventId: string, token: string): Promise<EventStats> {
  const response = await authFetch(`/api/events/${eventId}/stats`, {}, { token });
  if (!response.ok) {
    await parseError(response, "loadStats");
  }
  return response.json() as Promise<EventStats>;
}

export async function fetchEventSetupStatus(
  eventId: string,
  token: string,
): Promise<EventSetupStatus> {
  const response = await authFetch(`/api/events/${eventId}/setup-status`, {}, { token });
  if (!response.ok) {
    await parseError(response, "loadSetupStatus");
  }
  return response.json() as Promise<EventSetupStatus>;
}

export async function fetchMyEvents(token: string): Promise<UserEventSummary[]> {
  const response = await authFetch("/api/events/mine", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadYourEvents");
  }
  return response.json() as Promise<UserEventSummary[]>;
}

export async function fetchMyEventRuns(
  eventId: string,
  auth: AuthFetchOptions,
): Promise<MatchRunSummary[]> {
  const response = await authFetch(`/api/events/${eventId}/my-runs`, {}, auth);
  if (!response.ok) {
    await parseError(response, "loadPastSearches");
  }
  return response.json() as Promise<MatchRunSummary[]>;
}

export async function downloadEventGalleryZip(eventId: string, token: string, filename: string): Promise<void> {
  const response = await authFetch(`/api/events/${eventId}/gallery/download`, {}, { token });
  if (!response.ok) {
    await parseError(response, "downloadAlbum");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchStudioOrganizations(token: string): Promise<Organization[]> {
  const response = await authFetch("/api/studio/orgs", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadStudios");
  }
  const payload = (await response.json()) as { organizations: Organization[] };
  return payload.organizations;
}

export interface StudioOrgInvite {
  id: string;
  org_id: string;
  org_name?: string | null;
  org_slug?: string | null;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
  invited_by_email?: string | null;
}

export async function fetchStudioInvites(token: string): Promise<StudioOrgInvite[]> {
  const response = await authFetch("/api/studio/invites", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadInvites");
  }
  return response.json() as Promise<StudioOrgInvite[]>;
}

export async function acceptStudioInvite(inviteId: string, token: string): Promise<StudioOrgInvite> {
  const response = await authFetch(
    `/api/studio/invites/${inviteId}/accept`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "acceptInvite");
  }
  return response.json() as Promise<StudioOrgInvite>;
}

export async function declineStudioInvite(inviteId: string, token: string): Promise<StudioOrgInvite> {
  const response = await authFetch(
    `/api/studio/invites/${inviteId}/decline`,
    { method: "POST" },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "declineInvite");
  }
  return response.json() as Promise<StudioOrgInvite>;
}

export async function fetchStudioMe(token: string, orgId?: string | null): Promise<{ organization: Organization; member_role: string }> {
  const response = await authFetch("/api/studio/me", {}, studioAuth(token, orgId));
  if (!response.ok) {
    await parseError(response, "loadStudio");
  }
  return response.json() as Promise<{ organization: Organization; member_role: string }>;
}

export async function fetchStudioStats(token: string): Promise<StudioStats> {
  const response = await authFetch("/api/studio/stats", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadStudioStats");
  }
  return response.json() as Promise<StudioStats>;
}

export async function fetchStudioClients(token: string): Promise<StudioClient[]> {
  const response = await authFetch("/api/studio/events", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadClients");
  }
  return response.json() as Promise<StudioClient[]>;
}

export async function createStudioClient(
  body: {
    couple_names: string;
    wedding_date?: string | null;
    slug?: string | null;
    client_email?: string | null;
    photographer_notes?: string | null;
    title?: string | null;
  },
  token: string,
): Promise<StudioClient> {
  const response = await authFetch(
    "/api/studio/events",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "createClient");
  }
  return response.json() as Promise<StudioClient>;
}

export async function fetchStudioClient(eventId: string, token: string): Promise<StudioClient> {
  const response = await authFetch(`/api/studio/events/${eventId}`, {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadClient");
  }
  return response.json() as Promise<StudioClient>;
}

export async function updateStudioClient(
  eventId: string,
  body: Record<string, unknown>,
  token: string,
): Promise<StudioClient> {
  const response = await authFetch(
    `/api/studio/events/${eventId}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "updateClient");
  }
  return response.json() as Promise<StudioClient>;
}

export async function deleteStudioClient(eventId: string, token: string): Promise<void> {
  const response = await authFetch(`/api/studio/events/${eventId}`, { method: "DELETE" }, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "deleteClient");
  }
}

export async function bulkDeleteStudioClients(
  eventIds: string[],
  token: string,
): Promise<{ deleted: number; not_found: number; denied: number }> {
  const response = await authFetch(
    "/api/studio/events/bulk-delete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_ids: eventIds }),
    },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "bulkDeleteFailed");
  }
  return response.json() as Promise<{ deleted: number; not_found: number; denied: number }>;
}

/** Minimal event view for studio UI when public event fetch is unavailable. */
export function studioClientToEventPublic(client: StudioClient): EventPublic {
  return {
    id: client.id,
    slug: client.slug,
    title: client.title,
    wedding_date: client.wedding_date,
    status: client.status,
    branding: client.branding ?? {},
    default_threshold: 0.4,
    gallery_photo_count: client.gallery_photo_count,
    photographer_led: true,
    is_admin: true,
  };
}

export async function studioInviteCouple(eventId: string, email: string, token: string): Promise<void> {
  const response = await authFetch(
    `/api/studio/events/${eventId}/invite-couple`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "inviteCouple");
  }
}

export async function studioGoLive(eventId: string, token: string): Promise<StudioClient> {
  const response = await authFetch(`/api/studio/events/${eventId}/go-live`, { method: "POST" }, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "goLive");
  }
  return response.json() as Promise<StudioClient>;
}

export async function checkStudioSlug(slug: string, token: string): Promise<SlugCheckResult> {
  const params = new URLSearchParams({ slug });
  const response = await authFetch(`/api/studio/slug-check?${params}`, {}, { token });
  if (!response.ok) {
    await parseError(response, "checkSlug");
  }
  return response.json() as Promise<SlugCheckResult>;
}

export async function checkStudioTeamEmail(
  email: string,
  token: string,
): Promise<{ email: string; registered: boolean; already_member: boolean; invite_pending: boolean; can_invite: boolean }> {
  const params = new URLSearchParams({ email });
  const response = await authFetch(`/api/studio/team/email-check?${params}`, {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "checkEmail");
  }
  return response.json() as Promise<{
    email: string;
    registered: boolean;
    already_member: boolean;
    invite_pending: boolean;
    can_invite: boolean;
  }>;
}

export async function studioSignup(name: string, slug: string, token: string): Promise<{ organization: Organization; member_role: string }> {
  const response = await authFetch(
    "/api/studio/signup",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) },
    { token },
  );
  if (!response.ok) {
    await parseError(response, "createStudio");
  }
  return response.json() as Promise<{ organization: Organization; member_role: string }>;
}

export async function fetchStudioSettings(token: string): Promise<Organization> {
  const response = await authFetch("/api/studio/settings", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadSettings");
  }
  return response.json() as Promise<Organization>;
}

export async function updateStudioSettings(body: Record<string, unknown>, token: string): Promise<Organization> {
  const response = await authFetch(
    "/api/studio/settings",
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "saveSettings");
  }
  return response.json() as Promise<Organization>;
}

export async function fetchStudioTeam(token: string): Promise<Array<{ user_id: string; role: string; email?: string; full_name?: string }>> {
  const response = await authFetch("/api/studio/team", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadTeam");
  }
  return response.json() as Promise<Array<{ user_id: string; role: string; email?: string; full_name?: string }>>;
}

export async function fetchStudioTeamPendingInvites(token: string): Promise<StudioOrgInvite[]> {
  const response = await authFetch("/api/studio/team/pending-invites", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadPendingInvites");
  }
  return response.json() as Promise<StudioOrgInvite[]>;
}

export async function inviteStudioTeamMember(
  email: string,
  role: string,
  token: string,
): Promise<{ status: "invited" }> {
  const response = await authFetch(
    "/api/studio/team/invite",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "inviteTeamMember");
  }
  return response.json() as Promise<{ status: "invited" }>;
}

export async function fetchStudioBilling(token: string): Promise<StudioBilling> {
  const response = await authFetch("/api/studio/billing", {}, studioAuth(token));
  if (!response.ok) {
    await parseError(response, "loadBilling");
  }
  return response.json() as Promise<StudioBilling>;
}

export async function createStripeCheckout(
  body: {
    plan: string;
    paid_by?: string;
    event_id?: string | null;
    success_url: string;
    cancel_url: string;
  },
  token: string,
): Promise<{ checkout_url: string; session_id: string }> {
  const response = await authFetch(
    "/api/billing/checkout",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    studioAuth(token),
  );
  if (!response.ok) {
    await parseError(response, "startCheckout");
  }
  return response.json() as Promise<{ checkout_url: string; session_id: string }>;
}

export async function fetchAdminOrganizations(token: string): Promise<AdminOrganization[]> {
  const response = await authFetch("/api/admin/organizations", {}, { token });
  if (!response.ok) {
    await parseError(response, "loadOrganizations");
  }
  return response.json() as Promise<AdminOrganization[]>;
}
