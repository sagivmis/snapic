from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MatchedPhoto(BaseModel):
    source: Literal["upload", "url"]
    index: int
    score: float = Field(ge=0.0, le=1.0)
    filename: str | None = None
    url: str | None = None
    preview_base64: str
    image_base64: str | None = None
    image_mime: str = "image/jpeg"
    gallery_photo_id: str | None = None
    matched_person: Literal[1, 2, "both"] | None = None
    person_1_score: float | None = Field(default=None, ge=0.0, le=1.0)
    person_2_score: float | None = Field(default=None, ge=0.0, le=1.0)


class SkippedPhoto(BaseModel):
    source: Literal["upload", "url"]
    index: int
    reason: Literal["no_face_detected", "decode_failed", "fetch_failed", "not_an_image"]
    filename: str | None = None
    url: str | None = None


class MatchResponse(BaseModel):
    reference_face_detected: bool
    threshold: float
    total_gallery: int
    matched: list[MatchedPhoto]
    skipped: list[SkippedPhoto]
    share_id: str | None = None
    couple_mode: bool = False
    event_id: str | None = None
    match_run_id: str | None = None


class SharedMatchResponse(MatchResponse):
    share_id: str


class EventBranding(BaseModel):
    couple_names: str | None = None
    accent_color: str | None = None
    cover_image_path: str | None = None


class EventPublicResponse(BaseModel):
    id: str
    slug: str
    title: str
    wedding_date: str | None = None
    status: Literal["draft", "active", "archived"]
    branding: dict = Field(default_factory=dict)
    default_threshold: float = 0.4
    gallery_photo_count: int = 0
    auto_archive_days: int = 90


class EventCreateRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    wedding_date: str | None = None
    status: Literal["draft", "active", "archived"] = "draft"
    branding: dict = Field(default_factory=dict)
    default_threshold: float = 0.4
    admin_email: str | None = None


class EventUpdateRequest(BaseModel):
    title: str | None = None
    wedding_date: str | None = None
    status: Literal["draft", "active", "archived"] | None = None
    branding: dict | None = None
    default_threshold: float | None = None
    auto_archive_days: int | None = None


class GalleryPhotoResponse(BaseModel):
    id: str
    event_id: str
    filename: str | None = None
    mime_type: str = "image/jpeg"
    sort_order: int = 0
    created_at: str | None = None
    content_hash: str | None = None
    storage_path: str | None = None
    signed_url: str | None = None
    section: str = "general"


class GalleryPhotoSectionUpdate(BaseModel):
    section: str = Field(min_length=1, max_length=80)


class GalleryBulkDeleteRequest(BaseModel):
    photo_ids: list[str] = Field(min_length=1, max_length=500)


class GalleryBulkDeleteResponse(BaseModel):
    deleted: int
    not_found: int


class MatchRunSummary(BaseModel):
    id: str
    share_id: str | None = None
    matched_count: int
    created_at: str | None = None


class UserEventSummary(BaseModel):
    id: str
    slug: str
    title: str
    status: Literal["draft", "active", "archived"]
    is_admin: bool = False
    last_search_at: str | None = None
    search_count: int = 0


class EventStatsResponse(BaseModel):
    gallery_photo_count: int
    match_run_count: int
    unique_guest_sessions: int
    last_match_at: str | None = None


class SignupRequestCreate(BaseModel):
    email: str
    couple_names: str
    wedding_date: str | None = None
    message: str | None = None


class SignupRequestResponse(BaseModel):
    id: str
    email: str
    couple_names: str
    wedding_date: str | None = None
    message: str | None = None
    status: Literal["pending", "approved", "rejected"]
    created_at: str | None = None
    created_event_id: str | None = None


class SignupReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    slug: str | None = None
    title: str | None = None
    event_id: str | None = None


class AdminStatsResponse(BaseModel):
    events_count: int
    pending_requests: int
    total_gallery_photos: int
    total_match_runs: int


class HealthResponse(BaseModel):
    status: str


class PortraitQualityResponse(BaseModel):
    face_detected: bool
    warnings: list[str]
    face_count: int = 0
