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
    status: Literal["draft", "active", "closed"]
    branding: dict = Field(default_factory=dict)
    default_threshold: float = 0.4
    gallery_photo_count: int = 0
    gallery_indexing_in_progress: bool = False
    gallery_search_ready: bool = False
    unindexed_photo_count: int = 0
    failed_photo_count: int = 0
    auto_close_days: int = 90
    onboarding_completed_at: str | None = None
    organization_id: str | None = None
    organization: dict | None = None
    handoff_status: str | None = None
    photo_limit: int | None = None
    photographer_led: bool = False


class EventCreateRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    wedding_date: str | None = None
    status: Literal["draft", "active", "closed"] = "draft"
    branding: dict = Field(default_factory=dict)
    default_threshold: float = 0.4
    admin_email: str | None = None


class EventUpdateRequest(BaseModel):
    title: str | None = None
    wedding_date: str | None = None
    status: Literal["draft", "active", "closed"] | None = None
    branding: dict | None = None
    default_threshold: float | None = None
    auto_close_days: int | None = None
    complete_onboarding: bool | None = None


class EventSetupStatusResponse(BaseModel):
    branding_ok: bool
    has_photos: bool
    photo_count: int
    faces_indexed: bool
    unindexed_count: int
    failed_count: int = 0
    indexing_in_progress: bool = False
    gallery_search_ready: bool = False
    is_active: bool
    onboarding_completed: bool


class EventAlbumStatusResponse(BaseModel):
    photo_count: int
    pending_count: int
    failed_count: int
    indexing_in_progress: bool
    gallery_search_ready: bool


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
    total_gallery: int = 0
    created_at: str | None = None


class UserEventSummary(BaseModel):
    id: str
    slug: str
    title: str
    status: Literal["draft", "active", "closed"]
    is_admin: bool = False
    last_search_at: str | None = None
    search_count: int = 0
    needs_onboarding: bool = False


class EventStatsResponse(BaseModel):
    gallery_photo_count: int
    match_run_count: int
    unique_guest_sessions: int
    last_match_at: str | None = None


class PortraitQualityResponse(BaseModel):
    face_detected: bool
    warnings: list[str]
    face_count: int = 0


class SignupRequestCreate(BaseModel):
    email: str
    couple_names: str = ""
    wedding_date: str | None = None
    message: str | None = None
    request_type: Literal["couple", "photographer"] = "couple"
    organization_name: str | None = None


class OrganizationPublic(BaseModel):
    id: str
    name: str
    slug: str
    logo_storage_path: str | None = None
    website_url: str | None = None
    accent_color: str | None = None
    plan: str = "pay_per_event"
    branding_tier: str = "standard"
    settings: dict = Field(default_factory=dict)
    events_included_per_period: int = 0
    events_used_this_period: int = 0
    photos_cap_per_event: int | None = None
    member_role: str | None = None


class StudioMeResponse(BaseModel):
    organization: OrganizationPublic
    member_role: str


class StudioStatsResponse(BaseModel):
    active_clients: int
    draft_clients: int
    closed_clients: int
    total_photos: int
    total_searches: int
    pending_handoffs: int
    index_failures: int


class StudioClientCreateRequest(BaseModel):
    couple_names: str = Field(min_length=1, max_length=200)
    wedding_date: str | None = None
    slug: str | None = None
    client_email: str | None = None
    photographer_notes: str | None = None
    title: str | None = None


class StudioClientSummary(BaseModel):
    id: str
    slug: str
    title: str
    wedding_date: str | None = None
    status: Literal["draft", "active", "closed"]
    handoff_status: str
    client_email: str | None = None
    gallery_photo_count: int = 0
    match_run_count: int = 0
    unique_guest_sessions: int = 0
    unindexed_photo_count: int = 0
    created_at: str | None = None
    branding: dict = Field(default_factory=dict)


class StudioClientUpdateRequest(BaseModel):
    title: str | None = None
    wedding_date: str | None = None
    client_email: str | None = None
    photographer_notes: str | None = None
    handoff_status: str | None = None
    status: Literal["draft", "active", "closed"] | None = None
    branding: dict | None = None


class StudioSettingsUpdateRequest(BaseModel):
    name: str | None = None
    website_url: str | None = None
    accent_color: str | None = None
    settings: dict | None = None


class StudioInviteCoupleRequest(BaseModel):
    email: str


class StudioSignupRequest(BaseModel):
    name: str
    slug: str = ""


class StudioTeamInviteRequest(BaseModel):
    email: str
    role: Literal["owner", "associate"] = "associate"


class StudioTeamInviteResponse(BaseModel):
    status: Literal["invited", "added"]


class StudioTeamEmailCheckResponse(BaseModel):
    email: str
    registered: bool
    already_member: bool
    can_invite: bool


class StudioBillingResponse(BaseModel):
    plan: str
    branding_tier: str
    events_included_per_period: int
    events_used_this_period: int
    photos_cap_per_event: int | None = None
    stripe_customer_id: str | None = None


class StripeCheckoutRequest(BaseModel):
    plan: Literal["pay_per_event", "bundle_10", "bundle_25", "unlimited"]
    paid_by: Literal["photographer", "couple"] = "photographer"
    event_id: str | None = None
    success_url: str
    cancel_url: str


class StripeCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class AdminOrganizationSummary(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    owner_email: str | None = None
    events_count: int = 0
    events_used_this_period: int = 0
    events_included_per_period: int = 0
    created_at: str | None = None


class SignupRequestResponse(BaseModel):
    id: str
    email: str
    couple_names: str
    wedding_date: str | None = None
    message: str | None = None
    status: Literal["pending", "approved", "rejected"]
    request_type: Literal["couple", "photographer"] = "couple"
    organization_name: str | None = None
    created_at: str | None = None
    reviewed_at: str | None = None
    created_event_id: str | None = None
    welcome_email_sent: bool | None = None
    rejection_email_sent: bool | None = None


class SlugCheckResponse(BaseModel):
    slug: str
    available: bool
    suggestion: str | None = None


class AuditLogEntry(BaseModel):
    id: str
    actor_id: str | None = None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    event_id: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: str | None = None


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
    organizations_count: int = 0
    photographer_signups_pending: int = 0


class SentryTestResponse(BaseModel):
    backend_configured: bool
    backend_sent: bool
    message: str


class AdminEventSummary(BaseModel):
    id: str
    slug: str
    title: str
    wedding_date: str | None = None
    status: Literal["draft", "active", "closed"]
    branding: dict = Field(default_factory=dict)
    default_threshold: float = 0.4
    auto_close_days: int = 90
    created_at: str | None = None
    gallery_photo_count: int = 0
    match_run_count: int = 0
    unique_guest_sessions: int = 0
    last_match_at: str | None = None
    unindexed_photo_count: int = 0
    archive_due: bool = False
    organization_id: str | None = None
    organization_name: str | None = None
    paid_by: str | None = None
    plan_tier: str | None = None


class AdminAttentionEventRef(BaseModel):
    id: str
    slug: str
    title: str
    count: int | None = None


class AdminAttentionResponse(BaseModel):
    pending_signups: int
    active_empty_albums: int
    events_with_unindexed: int
    unindexed_photos: int
    archive_due_events: int
    empty_albums: list[AdminAttentionEventRef] = Field(default_factory=list)
    unindexed: list[AdminAttentionEventRef] = Field(default_factory=list)
    archive_due: list[AdminAttentionEventRef] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
