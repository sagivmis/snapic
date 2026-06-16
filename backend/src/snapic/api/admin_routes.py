from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from snapic.api.schemas import (
    AdminEventSummary,
    AdminStatsResponse,
    EventCreateRequest,
    EventPublicResponse,
    EventUpdateRequest,
    SignupRequestResponse,
    SignupReviewRequest,
)
from snapic.auth.jwt import AuthUser, require_super_admin
from snapic.db.invites import invite_event_admin
from snapic.db.repository import (
    add_event_member,
    allocate_event_slug,
    count_gallery_photos,
    create_event,
    fetch_event_by_id,
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
    return EventPublicResponse(
        id=row["id"],
        slug=row["slug"],
        title=row["title"],
        wedding_date=row.get("wedding_date"),
        status=row["status"],
        branding=row.get("branding") or {},
        default_threshold=row.get("default_threshold", 0.4),
        gallery_photo_count=count_gallery_photos(row["id"]),
        auto_archive_days=int(row.get("auto_archive_days") or 90),
    )


def _admin_event_summary(row: dict[str, Any]) -> AdminEventSummary:
    row = maybe_auto_archive_event(row)
    stats = get_event_stats(row["id"])
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
    )


@router.get("/events", response_model=list[AdminEventSummary])
async def admin_list_events(_: Annotated[AuthUser, Depends(require_super_admin)]) -> list[AdminEventSummary]:
    rows = list_events()
    return [_admin_event_summary(r) for r in rows]


@router.patch("/events/{event_id}", response_model=AdminEventSummary)
async def admin_update_event(
    event_id: str,
    body: EventUpdateRequest,
    _: Annotated[AuthUser, Depends(require_super_admin)],
) -> AdminEventSummary:
    if not fetch_event_by_id(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_event(event_id, payload)
    row = fetch_event_by_id(event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _admin_event_summary(row)


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

    if body.action == "reject":
        row = update_signup_request(
            request_id,
            {
                "status": "rejected",
                "reviewed_by": user.id,
                "reviewed_at": datetime.now(UTC).isoformat(),
            },
        )
    else:
        if body.event_id:
            event = fetch_event_by_id(body.event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
        else:
            slug = allocate_event_slug(_slugify(body.slug or target["couple_names"]))
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
        row = update_signup_request(
            request_id,
            {
                "status": "approved",
                "reviewed_by": user.id,
                "reviewed_at": datetime.now(UTC).isoformat(),
                "created_event_id": event["id"],
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
        created_event_id=row.get("created_event_id"),
    )


@router.post("/events/{event_id}/members")
async def admin_add_event_member(
    event_id: str,
    email: str,
    _: Annotated[AuthUser, Depends(require_super_admin)],
    role: str = "co_admin",
) -> dict[str, str]:
    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")
    invite_event_admin(email, event_id, event_row["slug"], role)
    return {"status": "invited", "email": email.strip().lower()}
