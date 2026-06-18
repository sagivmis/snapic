export type MatchedPerson = 1 | 2 | "both";

export interface MatchedPhoto {
  source: "upload" | "url";
  index: number;
  score: number;
  filename?: string | null;
  url?: string | null;
  preview_base64: string;
  image_base64?: string;
  image_mime?: string;
  gallery_photo_id?: string | null;
  matched_person?: MatchedPerson | null;
  person_1_score?: number | null;
  person_2_score?: number | null;
}

export interface SkippedPhoto {
  source: "upload" | "url";
  index: number;
  reason: string;
  filename?: string | null;
  url?: string | null;
}

export interface MatchResponse {
  reference_face_detected: boolean;
  threshold: number;
  total_gallery: number;
  matched: MatchedPhoto[];
  skipped: SkippedPhoto[];
  share_id?: string | null;
  couple_mode?: boolean;
  event_id?: string | null;
  match_run_id?: string | null;
}

export interface PortraitQualityResponse {
  face_detected: boolean;
  warnings: string[];
  face_count: number;
}

export interface MatchRequest {
  selfie: File;
  partnerSelfie?: File | null;
  galleryFiles: File[];
  galleryUrls: string[];
  threshold: number;
}

export interface EventPublic {
  id: string;
  slug: string;
  title: string;
  wedding_date?: string | null;
  status: "draft" | "active" | "archived";
  branding: Record<string, unknown>;
  default_threshold: number;
  gallery_photo_count?: number;
  gallery_indexing_in_progress?: boolean;
  gallery_search_ready?: boolean;
  unindexed_photo_count?: number;
  failed_photo_count?: number;
  auto_archive_days?: number;
  onboarding_completed_at?: string | null;
}

/** True when guests can run face search. */
export function isGallerySearchReady(event: EventPublic): boolean {
  if ((event.gallery_photo_count ?? 0) === 0) {
    return false;
  }
  return event.gallery_search_ready === true;
}

export interface EventCreateRequest {
  slug: string;
  title: string;
  wedding_date?: string | null;
  status?: "draft" | "active" | "archived";
  branding?: Record<string, unknown>;
  default_threshold?: number;
  admin_email?: string | null;
}

export interface EventUpdateRequest {
  title?: string;
  wedding_date?: string | null;
  status?: "draft" | "active" | "archived";
  branding?: Record<string, unknown>;
  default_threshold?: number;
  auto_archive_days?: number;
  complete_onboarding?: boolean;
}

export interface EventSetupStatus {
  branding_ok: boolean;
  has_photos: boolean;
  photo_count: number;
  faces_indexed: boolean;
  unindexed_count: number;
  failed_count: number;
  indexing_in_progress: boolean;
  gallery_search_ready: boolean;
  is_active: boolean;
  onboarding_completed: boolean;
}

export interface EventAlbumStatus {
  photo_count: number;
  pending_count: number;
  failed_count: number;
  indexing_in_progress: boolean;
  gallery_search_ready: boolean;
}

export type IndexScope = "all" | "pending" | "failed";

export interface GalleryPhoto {
  id: string;
  event_id: string;
  filename?: string | null;
  mime_type: string;
  sort_order: number;
  created_at?: string | null;
  content_hash?: string | null;
  storage_path?: string | null;
  signed_url?: string | null;
  section?: string;
}

export interface EventStats {
  gallery_photo_count: number;
  match_run_count: number;
  unique_guest_sessions: number;
  last_match_at?: string | null;
}

export interface MatchRunSummary {
  id: string;
  share_id?: string | null;
  matched_count: number;
  total_gallery?: number;
  created_at?: string | null;
}

export interface UserEventSummary {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "active" | "archived";
  is_admin: boolean;
  last_search_at?: string | null;
  search_count: number;
  needs_onboarding?: boolean;
}

export interface SignupRequestCreate {
  email: string;
  couple_names: string;
  wedding_date?: string | null;
  message?: string | null;
}

export interface SignupRequest {
  id: string;
  email: string;
  couple_names: string;
  wedding_date?: string | null;
  message?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at?: string | null;
  reviewed_at?: string | null;
  created_event_id?: string | null;
  welcome_email_sent?: boolean | null;
  rejection_email_sent?: boolean | null;
}

export interface SlugCheckResult {
  slug: string;
  available: boolean;
  suggestion?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  event_id?: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
}

export interface AdminStats {
  events_count: number;
  pending_requests: number;
  total_gallery_photos: number;
  total_match_runs: number;
}

export interface SentryTestResult {
  backend_configured: boolean;
  backend_sent: boolean;
  message: string;
}

export interface AdminEventSummary {
  id: string;
  slug: string;
  title: string;
  wedding_date?: string | null;
  status: "draft" | "active" | "archived";
  branding: Record<string, unknown>;
  default_threshold: number;
  auto_archive_days?: number;
  created_at?: string | null;
  gallery_photo_count: number;
  match_run_count: number;
  unique_guest_sessions: number;
  last_match_at?: string | null;
  unindexed_photo_count: number;
  archive_due: boolean;
}

export interface AdminAttentionEventRef {
  id: string;
  slug: string;
  title: string;
  count?: number | null;
}

export interface AdminAttention {
  pending_signups: number;
  active_empty_albums: number;
  events_with_unindexed: number;
  unindexed_photos: number;
  archive_due_events: number;
  empty_albums: AdminAttentionEventRef[];
  unindexed: AdminAttentionEventRef[];
  archive_due: AdminAttentionEventRef[];
}

export type CoupleFilter = "all" | "1" | "2" | "both";
