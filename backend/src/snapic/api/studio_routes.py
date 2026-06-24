from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from snapic.api.schemas import (
    OrganizationPublic,
    StudioBillingResponse,
    StudioClientCreateRequest,
    StudioClientSummary,
    StudioClientUpdateRequest,
    StudioInviteCoupleRequest,
    StudioMeResponse,
    StudioSettingsUpdateRequest,
    StudioSignupRequest,
    StudioStatsResponse,
    StudioTeamInviteRequest,
)
from snapic.auth.jwt import AuthUser, get_required_user
from snapic.auth.org import require_org_member, require_org_owner
from snapic.db.invites import invite_event_admin
from snapic.db.repository import (
    allocate_event_slug,
    count_failed_gallery_photos,
    count_org_events,
    count_unindexed_gallery_photos,
    create_event,
    fetch_event_by_id,
    fetch_organization,
    get_event_stats,
    get_primary_org_for_user,
    increment_org_events_used,
    is_org_event_access,
    is_org_owner,
    list_org_events,
    list_org_members,
    org_can_create_event,
    update_event,
    update_organization,
    update_profile_role,
)

router = APIRouter(prefix="/studio", tags=["studio"])


def _org_public(org: dict[str, Any], member_role: str | None = None) -> OrganizationPublic:
    return OrganizationPublic(
        id=org["id"],
        name=org["name"],
        slug=org["slug"],
        logo_storage_path=org.get("logo_storage_path"),
        website_url=org.get("website_url"),
        accent_color=org.get("accent_color"),
        plan=org.get("plan") or "pay_per_event",
        branding_tier=org.get("branding_tier") or "standard",
        settings=org.get("settings") or {},
        events_included_per_period=int(org.get("events_included_per_period") or 0),
        events_used_this_period=int(org.get("events_used_this_period") or 0),
        photos_cap_per_event=org.get("photos_cap_per_event"),
        member_role=member_role,
    )


def _client_summary(row: dict[str, Any]) -> StudioClientSummary:
    stats = get_event_stats(row["id"])
    branding = row.get("branding") or {}
    return StudioClientSummary(
        id=row["id"],
        slug=row["slug"],
        title=row["title"],
        wedding_date=row.get("wedding_date"),
        status=row["status"],
        handoff_status=row.get("handoff_status") or "draft",
        client_email=row.get("client_email"),
        gallery_photo_count=stats["gallery_photo_count"],
        match_run_count=stats["match_run_count"],
        unique_guest_sessions=stats["unique_guest_sessions"],
        unindexed_photo_count=count_unindexed_gallery_photos(row["id"]),
        created_at=row.get("created_at"),
        branding=branding,
    )


def _assert_client_access(user: AuthUser, event_id: str) -> dict[str, Any]:
    if not is_org_event_access(user.id, event_id):
        raise HTTPException(status_code=403, detail="Access denied")
    row = fetch_event_by_id(event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return row


@router.get("/me", response_model=StudioMeResponse)
async def studio_me(
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> StudioMeResponse:
    member_role = org.get("member_role") or "associate"
    return StudioMeResponse(organization=_org_public(org, member_role), member_role=member_role)


@router.get("/stats", response_model=StudioStatsResponse)
async def studio_stats(
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> StudioStatsResponse:
    events = list_org_events(org["id"])
    active = draft = closed = total_photos = total_searches = pending_handoffs = index_failures = 0
    for row in events:
        status = row.get("status")
        if status == "active":
            active += 1
        elif status == "closed":
            closed += 1
        else:
            draft += 1
        stats = get_event_stats(row["id"])
        total_photos += stats["gallery_photo_count"]
        total_searches += stats["match_run_count"]
        handoff = row.get("handoff_status") or "draft"
        if handoff in ("uploaded", "draft") and stats["gallery_photo_count"] > 0:
            pending_handoffs += 1
        index_failures += count_failed_gallery_photos(row["id"])
    return StudioStatsResponse(
        active_clients=active,
        draft_clients=draft,
        closed_clients=closed,
        total_photos=total_photos,
        total_searches=total_searches,
        pending_handoffs=pending_handoffs,
        index_failures=index_failures,
    )


@router.get("/events", response_model=list[StudioClientSummary])
async def studio_list_events(
    _: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> list[StudioClientSummary]:
    return [_client_summary(row) for row in list_org_events(org["id"])]


@router.post("/events", response_model=StudioClientSummary)
async def studio_create_event(
    body: StudioClientCreateRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> StudioClientSummary:
    can_create, reason = org_can_create_event(org["id"])
    if not can_create:
        raise HTTPException(status_code=402, detail=reason or "Cannot create event")
    base_slug = body.slug or body.couple_names
    slug = allocate_event_slug(base_slug.replace(" ", "-").lower() if body.slug is None else body.slug)
    title = body.title or f"{body.couple_names} Wedding"
    photo_limit = org.get("photos_cap_per_event")
    row = create_event(
        {
            "slug": slug,
            "title": title,
            "wedding_date": body.wedding_date,
            "organization_id": org["id"],
            "client_email": body.client_email,
            "photographer_notes": body.photographer_notes,
            "handoff_status": "draft",
            "created_by": user.id,
            "photo_limit": photo_limit,
            "plan_tier": org.get("plan"),
            "branding": {"couple_names": body.couple_names},
        }
    )
    plan = org.get("plan") or "pay_per_event"
    if plan not in ("pay_per_event",):
        increment_org_events_used(org["id"])
    return _client_summary(row)


@router.get("/events/{event_id}", response_model=StudioClientSummary)
async def studio_get_event(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> StudioClientSummary:
    row = _assert_client_access(user, event_id)
    return _client_summary(row)


@router.patch("/events/{event_id}", response_model=StudioClientSummary)
async def studio_update_event(
    event_id: str,
    body: StudioClientUpdateRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> StudioClientSummary:
    row = _assert_client_access(user, event_id)
    patch = body.model_dump(exclude_unset=True)
    if patch:
        row = update_event(event_id, patch)
    return _client_summary(row)


@router.post("/events/{event_id}/invite-couple")
async def studio_invite_couple(
    event_id: str,
    body: StudioInviteCoupleRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> dict[str, str]:
    row = _assert_client_access(user, event_id)
    cleaned = body.email.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Email required")
    invite_event_admin(
        event_id=event_id,
        email=cleaned,
        event_slug=row["slug"],
        event_title=row["title"],
        role="admin",
    )
    update_event(event_id, {"handoff_status": "invited", "client_email": cleaned})
    return {"status": "invited"}


@router.post("/events/{event_id}/go-live", response_model=StudioClientSummary)
async def studio_go_live(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> StudioClientSummary:
    row = _assert_client_access(user, event_id)
    settings = org.get("settings") or {}
    if settings.get("require_couple_go_live") and not is_org_owner(user.id, org["id"]):
        raise HTTPException(status_code=403, detail="Couple must approve go-live")
    photo_count = get_event_stats(event_id)["gallery_photo_count"]
    if photo_count == 0:
        raise HTTPException(status_code=400, detail="Upload photos before going live")
    pending = count_unindexed_gallery_photos(event_id)
    if pending > 0:
        raise HTTPException(status_code=400, detail="Finish indexing faces before going live")
    row = update_event(event_id, {"status": "active", "handoff_status": "live"})
    return _client_summary(row)


@router.get("/settings", response_model=OrganizationPublic)
async def studio_get_settings(
    _: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> OrganizationPublic:
    return _org_public(org, org.get("member_role"))


@router.patch("/settings", response_model=OrganizationPublic)
async def studio_update_settings(
    body: StudioSettingsUpdateRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_owner)],
) -> OrganizationPublic:
    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.website_url is not None:
        patch["website_url"] = body.website_url
    if body.accent_color is not None:
        patch["accent_color"] = body.accent_color
    if body.settings is not None:
        current = org.get("settings") or {}
        patch["settings"] = {**current, **body.settings}
    updated = update_organization(org["id"], patch)
    return _org_public(updated, "owner")


@router.get("/team")
async def studio_list_team(
    _: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> list[dict[str, Any]]:
    return list_org_members(org["id"])


@router.post("/team/invite")
async def studio_invite_team(
    body: StudioTeamInviteRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_owner)],
) -> dict[str, str]:
    from snapic.db.supabase_client import get_supabase

    email = body.email.strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    client = get_supabase()
    client.auth.admin.invite_user_by_email(
        email,
        options={
            "data": {
                "pending_org_id": org["id"],
                "pending_org_role": body.role,
            },
            "app_metadata": {"role": "photographer"},
        },
    )
    return {"status": "invited"}


@router.get("/billing", response_model=StudioBillingResponse)
async def studio_billing(
    _: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_owner)],
) -> StudioBillingResponse:
    return StudioBillingResponse(
        plan=org.get("plan") or "pay_per_event",
        branding_tier=org.get("branding_tier") or "standard",
        events_included_per_period=int(org.get("events_included_per_period") or 0),
        events_used_this_period=int(org.get("events_used_this_period") or 0),
        photos_cap_per_event=org.get("photos_cap_per_event"),
        stripe_customer_id=org.get("stripe_customer_id"),
    )


@router.post("/signup", response_model=StudioMeResponse)
async def studio_signup(
    body: StudioSignupRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> StudioMeResponse:
    from snapic.db.repository import add_org_member, allocate_org_slug, create_organization

    existing = get_primary_org_for_user(user.id)
    if existing:
        return StudioMeResponse(
            organization=_org_public(existing, existing.get("member_role", "owner")),
            member_role=existing.get("member_role", "owner"),
        )
    org_slug = allocate_org_slug(body.slug or body.name)
    org = create_organization(
        {
            "name": body.name.strip(),
            "slug": org_slug,
            "plan": "pay_per_event",
            "branding_tier": "standard",
            "events_included_per_period": 0,
            "photos_cap_per_event": 1500,
        }
    )
    add_org_member(org["id"], user.id, "owner")
    update_profile_role(user.id, "photographer")
    org_with_role = {**org, "member_role": "owner"}
    return StudioMeResponse(organization=_org_public(org_with_role, "owner"), member_role="owner")
