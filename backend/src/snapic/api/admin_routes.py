from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from snapic.api.schemas import (
    AdminAttentionResponse,
    AdminEventSummary,
    AdminStatsResponse,
    AuditLogEntry,
    EventCreateRequest,
    EventPublicResponse,
    EventUpdateRequest,
    SignupRequestResponse,
    SignupReviewRequest,
    SlugCheckResponse,
)
from snapic.auth.jwt import AuthUser, require_super_admin
from snapic.db.approval_email import send_gallery_approval_email, send_signup_rejection_email
from snapic.db.audit_log import list_audit_log, record_audit_log
from snapic.db.invites import invite_event_admin
from snapic.db.repository import (
    add_event_member,
    allocate_event_slug,
    count_gallery_photos,
    count_failed_gallery_photos,
    count_pending_gallery_photos,
    count_unindexed_gallery_photos,
    create_event,
    delete_event,
    event_archive_due,
    fetch_event_by_id,
    gallery_search_ready,
    is_event_gallery_indexing,
    fetch_event_by_slug,
    find_profile_by_email,
    get_event_stats,
    list_events,
    list_signup_requests,
    maybe_auto_archive_event,
    update_event,
    update_profile_role,
    update_signup_request,
)
from snapic.db.supabase_client import get_supabase

router = APIRouter(prefix="/admin", tags=["admin"])


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "event"


def _audit(
    user: AuthUser,
    action: str,
    entity_type: str,
    *,
    entity_id: str | None = None,
    event_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    record_audit_log(
        actor_id=user.id,
        actor_email=user.email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        event_id=event_id,
        metadata=metadata,
    )


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(_: Annotated[AuthUser, Depends(require_super_admin)]) -> AdminStatsResponse:
    client = get_supabase()
    events = client.table("events").select("id", count="exact").execute()
    pending = client.table("signup_requests").select("id", count="exact").eq("status", "pending").execute()
    photos = client.table("gallery_photos").select("id", count="exact").execute()
    runs = client.table("match_runs").select("id", count="exact").execute()
    return AdminStatsResponse(
        events_count=events.count or 0,
        pending_requests=pending.count or 0,
        total_gallery_photos=photos.count or 0,
        total_match_runs=runs.count or 0,
    )


def _event_public(row: dict[str, Any]) -> EventPublicResponse:
    row = maybe_auto_archive_event(row)
    event_id = row["id"]
    photo_count = count_gallery_photos(event_id)
    pending = count_pending_gallery_photos(event_id)
    failed = count_failed_gallery_photos(event_id)
    indexing = is_event_gallery_indexing(row)
    return EventPublicResponse(
        id=event_id,
        slug=row["slug"],
        title=row["title"],
        wedding_date=row.get("wedding_date"),
        status=row["status"],
        branding=row.get("branding") or {},
        default_threshold=row.get("default_threshold", 0.4),
        gallery_photo_count=photo_count,
        gallery_indexing_in_progress=indexing,
        gallery_search_ready=gallery_search_ready(row, photo_count=photo_count, pending=pending),
        unindexed_photo_count=pending,
        failed_photo_count=failed,
        auto_archive_days=int(row.get("auto_archive_days") or 90),
        onboarding_completed_at=row.get("onboarding_completed_at"),
    )


def _admin_event_summary(row: dict[str, Any], *, apply_auto_archive: bool = True) -> AdminEventSummary:
    if apply_auto_archive:
        row = maybe_auto_archive_event(row)
    stats = get_event_stats(row["id"])
    unindexed = count_unindexed_gallery_photos(row["id"])
    return AdminEventSummary(
        id=row["id"],
        slug=row["slug"],
        title=row["title"],
        wedding_date=row.get("wedding_date"),
        status=row["status"],
        branding=row.get("branding") or {},
        default_threshold=row.get("default_threshold", 0.4),
        auto_archive_days=int(row.get("auto_archive_days") or 90),
        created_at=row.get("created_at"),
        gallery_photo_count=stats["gallery_photo_count"],
        match_run_count=stats["match_run_count"],
        unique_guest_sessions=stats["unique_guest_sessions"],
        last_match_at=stats["last_match_at"],
        unindexed_photo_count=unindexed,
        archive_due=event_archive_due(row),
    )


@router.get("/slug-check", response_model=SlugCheckResponse)
async def admin_slug_check(
    slug: str,
    _: Annotated[AuthUser, Depends(require_super_admin)],
) -> SlugCheckResponse:
    cleaned = _slugify(slug)
    if fetch_event_by_slug(cleaned) is None:
        return SlugCheckResponse(slug=cleaned, available=True)
    suggestion = allocate_event_slug(cleaned)
    return SlugCheckResponse(slug=cleaned, available=False, suggestion=suggestion)


@router.get("/audit-log", response_model=list[AuditLogEntry])
async def admin_audit_log(
    _: Annotated[AuthUser, Depends(require_super_admin)],
    limit: int = 50,
) -> list[AuditLogEntry]:
    rows = list_audit_log(limit)
    return [
        AuditLogEntry(
            id=r["id"],
            actor_id=r.get("actor_id"),
            actor_email=r.get("actor_email"),
            action=r["action"],
            entity_type=r["entity_type"],
            entity_id=r.get("entity_id"),
            event_id=r.get("event_id"),
            metadata=r.get("metadata") or {},
            created_at=r.get("created_at"),
        )
        for r in rows
    ]


@router.get("/attention", response_model=AdminAttentionResponse)
async def admin_attention(_: Annotated[AuthUser, Depends(require_super_admin)]) -> AdminAttentionResponse:
    client = get_supabase()
    pending = client.table("signup_requests").select("id", count="exact").eq("status", "pending").execute()

    empty_albums = []
    unindexed = []
    archive_due = []
    unindexed_photos = 0

    for row in list_events():
        photo_count = count_gallery_photos(row["id"])
        if row.get("status") == "active" and photo_count == 0:
            empty_albums.append(
                {"id": row["id"], "slug": row["slug"], "title": row["title"], "count": None}
            )

        unindexed_count = count_unindexed_gallery_photos(row["id"])
        if unindexed_count > 0 and row.get("status") != "archived":
            unindexed.append(
                {
                    "id": row["id"],
                    "slug": row["slug"],
                    "title": row["title"],
                    "count": unindexed_count,
                }
            )
            unindexed_photos += unindexed_count

        if event_archive_due(row):
            archive_due.append(
                {"id": row["id"], "slug": row["slug"], "title": row["title"], "count": None}
            )

    return AdminAttentionResponse(
        pending_signups=pending.count or 0,
        active_empty_albums=len(empty_albums),
        events_with_unindexed=len(unindexed),
        unindexed_photos=unindexed_photos,
        archive_due_events=len(archive_due),
        empty_albums=empty_albums,
        unindexed=unindexed,
        archive_due=archive_due,
    )


@router.get("/events", response_model=list[AdminEventSummary])
async def admin_list_events(_: Annotated[AuthUser, Depends(require_super_admin)]) -> list[AdminEventSummary]:
    rows = list_events()
    return [_admin_event_summary(r) for r in rows]


@router.patch("/events/{event_id}", response_model=AdminEventSummary)
async def admin_update_event(
    event_id: str,
    body: EventUpdateRequest,
    user: Annotated[AuthUser, Depends(require_super_admin)],
) -> AdminEventSummary:
    existing = fetch_event_by_id(event_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_event(event_id, payload)
    _audit(
        user,
        "event.update",
        "event",
        entity_id=event_id,
        event_id=event_id,
        metadata={"changes": payload, "previous_status": existing.get("status")},
    )
    row = fetch_event_by_id(event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _admin_event_summary(row)


@router.delete("/events/{event_id}")
async def admin_delete_event(
    event_id: str,
    user: Annotated[AuthUser, Depends(require_super_admin)],
) -> dict[str, str]:
    existing = fetch_event_by_id(event_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    delete_event(event_id)
    _audit(
        user,
        "event.delete",
        "event",
        entity_id=event_id,
        metadata={"slug": existing.get("slug"), "title": existing.get("title")},
    )
    return {"status": "deleted", "event_id": event_id}


@router.post("/events", response_model=EventPublicResponse)
async def admin_create_event(
    body: EventCreateRequest,
    user: Annotated[AuthUser, Depends(require_super_admin)],
) -> EventPublicResponse:
    slug = _slugify(body.slug)
    if fetch_event_by_slug(slug):
        raise HTTPException(status_code=409, detail=f"Event slug '{slug}' is already taken")
    row = create_event(
        {
            "slug": slug,
            "title": body.title,
            "wedding_date": body.wedding_date,
            "status": body.status,
            "branding": body.branding,
            "default_threshold": body.default_threshold,
            "created_by": user.id,
        }
    )
    if body.admin_email:
        invite_event_admin(body.admin_email, row["id"], row["slug"], "admin")
    _audit(
        user,
        "event.create",
        "event",
        entity_id=row["id"],
        event_id=row["id"],
        metadata={"slug": row["slug"], "title": row["title"]},
    )
    return _event_public(row)


@router.get("/signup-requests", response_model=list[SignupRequestResponse])
async def admin_list_signup_requests(
    _: Annotated[AuthUser, Depends(require_super_admin)],
    status: str | None = None,
) -> list[SignupRequestResponse]:
    rows = list_signup_requests(status)
    return [
        SignupRequestResponse(
            id=r["id"],
            email=r["email"],
            couple_names=r["couple_names"],
            wedding_date=r.get("wedding_date"),
            message=r.get("message"),
            status=r["status"],
            created_at=r.get("created_at"),
            reviewed_at=r.get("reviewed_at"),
            created_event_id=r.get("created_event_id"),
        )
        for r in rows
    ]


@router.post("/signup-requests/{request_id}/review", response_model=SignupRequestResponse)
async def admin_review_signup(
    request_id: str,
    body: SignupReviewRequest,
    user: Annotated[AuthUser, Depends(require_super_admin)],
) -> SignupRequestResponse:
    pending = list_signup_requests("pending")
    target = next((r for r in pending if r["id"] == request_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Pending request not found")

    welcome_email_sent: bool | None = None
    rejection_email_sent: bool | None = None
    if body.action == "reject":
        rejection_email_sent = send_signup_rejection_email(target["email"], target["couple_names"])
        row = update_signup_request(
            request_id,
            {
                "status": "rejected",
                "reviewed_by": user.id,
                "reviewed_at": datetime.now(UTC).isoformat(),
            },
        )
        _audit(
            user,
            "signup.reject",
            "signup_request",
            entity_id=request_id,
            metadata={
                "email": target["email"],
                "couple_names": target["couple_names"],
                "rejection_email_sent": rejection_email_sent,
            },
        )
    else:
        if body.event_id:
            event = fetch_event_by_id(body.event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
        else:
            slug = _slugify(body.slug or target["couple_names"])
            if fetch_event_by_slug(slug):
                raise HTTPException(status_code=409, detail=f"Event slug '{slug}' is already taken")
            title = body.title or f"{target['couple_names']} Wedding"
            event = create_event(
                {
                    "slug": slug,
                    "title": title,
                    "wedding_date": target.get("wedding_date"),
                    "status": "draft",
                    "branding": {"couple_names": target["couple_names"]},
                    "created_by": user.id,
                }
            )
        profile = find_profile_by_email(target["email"])
        if profile:
            add_event_member(event["id"], profile["id"], "admin")
            update_profile_role(profile["id"], "event_admin")
        else:
            invite_event_admin(target["email"], event["id"], event["slug"], "admin")
        welcome_email_sent = send_gallery_approval_email(
            target["email"], target["couple_names"], event["slug"]
        )
        row = update_signup_request(
            request_id,
            {
                "status": "approved",
                "reviewed_by": user.id,
                "reviewed_at": datetime.now(UTC).isoformat(),
                "created_event_id": event["id"],
            },
        )
        _audit(
            user,
            "signup.approve",
            "signup_request",
            entity_id=request_id,
            event_id=event["id"],
            metadata={
                "email": target["email"],
                "couple_names": target["couple_names"],
                "event_slug": event["slug"],
                "linked_existing": bool(body.event_id),
                "welcome_email_sent": welcome_email_sent,
            },
        )
    return SignupRequestResponse(
        id=row["id"],
        email=row["email"],
        couple_names=row["couple_names"],
        wedding_date=row.get("wedding_date"),
        message=row.get("message"),
        status=row["status"],
        created_at=row.get("created_at"),
        reviewed_at=row.get("reviewed_at"),
        created_event_id=row.get("created_event_id"),
        welcome_email_sent=welcome_email_sent,
        rejection_email_sent=rejection_email_sent,
    )


@router.post("/events/{event_id}/members")
async def admin_add_event_member(
    event_id: str,
    email: str,
    user: Annotated[AuthUser, Depends(require_super_admin)],
    role: str = "admin",
) -> dict[str, str]:
    if role not in ("admin", "co_admin"):
        raise HTTPException(status_code=400, detail="role must be admin or co_admin")
    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")
    invite_event_admin(email, event_id, event_row["slug"], role)
    _audit(
        user,
        "event.invite",
        "event",
        entity_id=event_id,
        event_id=event_id,
        metadata={"email": email.strip().lower(), "role": role},
    )
    return {"status": "invited", "email": email.strip().lower(), "role": role}
