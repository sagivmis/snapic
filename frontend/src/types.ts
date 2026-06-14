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
}

export interface GalleryPhoto {
  id: string;
  event_id: string;
  filename?: string | null;
  mime_type: string;
  sort_order: number;
  created_at?: string | null;
  content_hash?: string | null;
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
  created_event_id?: string | null;
}

export interface AdminStats {
  events_count: number;
  pending_requests: number;
  total_gallery_photos: number;
  total_match_runs: number;
}

export type CoupleFilter = "all" | "1" | "2" | "both";
