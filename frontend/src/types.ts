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
