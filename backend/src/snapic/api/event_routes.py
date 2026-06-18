from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import io
import json
import uuid
import zipfile
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse

from snapic.api.rate_limit import enforce_match_rate_limit
from snapic.api.schemas import (
    EventAlbumStatusResponse,
    EventPublicResponse,
    EventSetupStatusResponse,
    EventStatsResponse,
    EventUpdateRequest,
    GalleryBulkDeleteRequest,
    GalleryBulkDeleteResponse,
    GalleryPhotoResponse,
    GalleryPhotoSectionUpdate,
    MatchResponse,
    MatchRunSummary,
    UserEventSummary,
)
from snapic.auth.jwt import AuthUser, get_anonymous_session_id, get_optional_user, get_required_user
from snapic.db import is_supabase_configured
from snapic.db.approval_email import send_album_ready_email, send_gallery_live_email
from snapic.db.repository import (
    bulk_delete_gallery_photos,
    batch_create_gallery_preview_urls,
    count_gallery_photos,
    count_failed_gallery_photos,
    count_pending_gallery_photos,
    count_unindexed_gallery_photos,
    gallery_search_ready,
    create_gallery_signed_url,
    delete_gallery_photo,
    download_storage_bytes,
    fetch_event_by_id,
    fetch_event_by_slug,
    fetch_gallery_photo_by_id,
    find_gallery_photo_by_hash,
    get_event_stats,
    index_gallery_photo_faces,
    is_event_admin,
    is_event_gallery_indexing,
    list_gallery_photos,
    list_gallery_sections,
    list_event_admin_emails,
    list_user_events,
    list_user_match_runs,
    maybe_auto_archive_event,
    set_event_gallery_indexing,
    update_event,
    update_gallery_photo_section,
    upload_gallery_photo,
)
from snapic.face.event_match import iter_event_gallery_matches
from snapic.face.gallery_index import iter_gallery_face_index
from snapic.face.images import decode_image_bytes
from snapic.face.pipeline import NoFaceInSelfieError, extract_reference_embedding

router = APIRouter(prefix="/events", tags=["events"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_THRESHOLD = 0.4


async def _read_upload_limited(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"Image too large: {upload.filename}")
    return data


def _assert_event_available_for_match(
    event_row: dict[str, Any],
    event_id: str,
    user: AuthUser | None,
) -> dict[str, Any]:
    event_row = maybe_auto_archive_event(event_row)
    status = event_row["status"]
    if status == "archived":
        raise HTTPException(status_code=403, detail="This event has ended")
    if status == "draft":
        if user is None or not is_event_admin(user.id, event_id):
            raise HTTPException(status_code=403, detail="Event not active yet")
    elif status != "active":
        raise HTTPException(status_code=403, detail="Event is not available")
    return event_row


async def _prepare_event_match_context(
    event_id: str,
    selfie: UploadFile,
    partner_selfie: UploadFile | None,
    threshold: float | None,
    user: AuthUser | None,
) -> tuple[dict[str, Any], list[Any], bool, float, list[dict[str, Any]]]:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")

    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")

    event_row = _assert_event_available_for_match(event_row, event_id, user)

    effective_threshold = threshold if threshold is not None else event_row.get("default_threshold", DEFAULT_THRESHOLD)
    if effective_threshold < 0.0 or effective_threshold > 1.0:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    gallery = list_gallery_photos(event_id)
    if not gallery:
        raise HTTPException(status_code=400, detail="Album still uploading — check back soon")

    unindexed = count_pending_gallery_photos(event_id)
    if unindexed > 0:
        raise HTTPException(
            status_code=503,
            detail=f"Gallery still indexing — {unindexed} photo{'s' if unindexed != 1 else ''} remaining. Try again shortly.",
        )
    if is_event_gallery_indexing(event_row):
        raise HTTPException(
            status_code=503,
            detail="Gallery face indexing is in progress. Try again shortly.",
        )

    selfie_bytes = await _read_upload_limited(selfie)
    try:
        selfie_image = decode_image_bytes(selfie_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not decode selfie image") from exc

    try:
        references: list[Any] = [extract_reference_embedding(selfie_image)]
    except NoFaceInSelfieError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    couple_mode = False
    if partner_selfie is not None and partner_selfie.filename:
        partner_bytes = await _read_upload_limited(partner_selfie)
        try:
            partner_image = decode_image_bytes(partner_bytes)
            references.append(extract_reference_embedding(partner_image))
            couple_mode = True
        except NoFaceInSelfieError as exc:
            raise HTTPException(status_code=400, detail="No face detected in partner portrait") from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not decode partner portrait") from exc

    return event_row, references, couple_mode, effective_threshold, gallery


def _ndjson_line(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload) + "\n").encode("utf-8")


def _event_public(row: dict[str, Any]) -> EventPublicResponse:
    row = maybe_auto_archive_event(row)
    branding = row.get("branding") or {}
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
        branding=branding,
        default_threshold=row.get("default_threshold", 0.4),
        gallery_photo_count=photo_count,
        gallery_indexing_in_progress=indexing,
        gallery_search_ready=gallery_search_ready(row, photo_count=photo_count, pending=pending),
        unindexed_photo_count=pending,
        failed_photo_count=failed,
        auto_archive_days=int(row.get("auto_archive_days") or 90),
        onboarding_completed_at=row.get("onboarding_completed_at"),
    )


def _event_album_status(event_id: str, row: dict[str, Any]) -> EventAlbumStatusResponse:
    photo_count = count_gallery_photos(event_id)
    pending = count_pending_gallery_photos(event_id)
    failed = count_failed_gallery_photos(event_id)
    indexing = is_event_gallery_indexing(row)
    return EventAlbumStatusResponse(
        photo_count=photo_count,
        pending_count=pending,
        failed_count=failed,
        indexing_in_progress=indexing,
        gallery_search_ready=gallery_search_ready(row, photo_count=photo_count, pending=pending),
    )


def _event_setup_status(event_id: str, row: dict[str, Any]) -> EventSetupStatusResponse:
    branding = row.get("branding") or {}
    couple_names = branding.get("couple_names")
    branding_ok = isinstance(couple_names, str) and bool(couple_names.strip())
    album = _event_album_status(event_id, row)
    has_photos = album.photo_count > 0
    return EventSetupStatusResponse(
        branding_ok=branding_ok,
        has_photos=has_photos,
        photo_count=album.photo_count,
        faces_indexed=has_photos and album.pending_count == 0 and not album.indexing_in_progress,
        unindexed_count=album.pending_count,
        failed_count=album.failed_count,
        indexing_in_progress=album.indexing_in_progress,
        gallery_search_ready=album.gallery_search_ready,
        is_active=row.get("status") == "active",
        onboarding_completed=bool(row.get("onboarding_completed_at")),
    )


def _photos_for_index_scope(photos: list[dict[str, Any]], scope: str) -> list[dict[str, Any]]:
    normalized = (scope or "all").strip().lower()
    if normalized == "all":
        return photos
    if normalized == "failed":
        return [p for p in photos if p.get("face_index_status") == "failed"]
    if normalized == "pending":
        return [p for p in photos if p.get("face_index_status") in ("pending", None)]
    raise HTTPException(status_code=400, detail="scope must be all, pending, or failed")


@router.get("/by-slug/{slug}", response_model=EventPublicResponse)
async def get_event_by_slug(
    slug: str,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
) -> EventPublicResponse:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")
    row = fetch_event_by_slug(slug)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")

    row = maybe_auto_archive_event(row)
    if row["status"] in ("active", "archived"):
        return _event_public(row)

    if user is not None and is_event_admin(user.id, row["id"]):
        return _event_public(row)

    raise HTTPException(status_code=404, detail="Event not found")


@router.get("/mine", response_model=list[UserEventSummary])
async def list_my_events(
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> list[UserEventSummary]:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")
    rows = list_user_events(user.id)
    return [UserEventSummary(**row) for row in rows]


def _gallery_photo_response(row: dict[str, Any], *, include_signed_url: bool = False) -> GalleryPhotoResponse:
    storage_path = row.get("storage_path")
    signed_url = create_gallery_signed_url(storage_path) if include_signed_url and storage_path else None
    return GalleryPhotoResponse(
        id=row["id"],
        event_id=row["event_id"],
        filename=row.get("filename"),
        mime_type=row.get("mime_type", "image/jpeg"),
        sort_order=row.get("sort_order", 0),
        created_at=row.get("created_at"),
        content_hash=row.get("content_hash"),
        storage_path=storage_path if include_signed_url else None,
        signed_url=signed_url,
        section=row.get("section") or "general",
    )


@router.get("/{event_id}/gallery", response_model=list[GalleryPhotoResponse])
async def list_event_gallery(
    event_id: str,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
    include_urls: Annotated[bool, Query()] = False,
) -> list[GalleryPhotoResponse]:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")
    photos = list_gallery_photos(event_id)
    is_admin = user is not None and is_event_admin(user.id, event_id)
    sign_urls = include_urls and is_admin
    return [_gallery_photo_response(p, include_signed_url=sign_urls) for p in photos]


@router.get("/{event_id}/gallery/preview-urls")
async def list_gallery_preview_urls(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 48,
) -> dict[str, Any]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = list_gallery_photos(event_id)
    batch = photos[offset : offset + limit]
    return {
        "urls": batch_create_gallery_preview_urls(event_id, batch),
        "offset": offset,
        "limit": limit,
        "total": len(photos),
    }


@router.get("/{event_id}/gallery/sections", response_model=list[str])
async def list_event_gallery_sections(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> list[str]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    return list_gallery_sections(event_id)


def _maybe_send_album_ready_email(event_id: str) -> None:
    row = fetch_event_by_id(event_id)
    if not row:
        return
    branding = row.get("branding") or {}
    photo_count = count_gallery_photos(event_id)
    unindexed = count_unindexed_gallery_photos(event_id)
    if (
        photo_count > 0
        and unindexed == 0
        and row.get("status") != "active"
        and not branding.get("album_ready_email_sent_at")
    ):
        couple_names = branding.get("couple_names") or row.get("title") or "Your gallery"
        if send_album_ready_email(list_event_admin_emails(event_id), str(couple_names), row["slug"]):
            update_event(
                event_id,
                {
                    "branding": {
                        **branding,
                        "album_ready_email_sent_at": datetime.now(UTC).isoformat(),
                    }
                },
            )


@router.get("/{event_id}/album-status", response_model=EventAlbumStatusResponse)
async def get_event_album_status(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> EventAlbumStatusResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    row = fetch_event_by_id(event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_album_status(event_id, row)


@router.post("/{event_id}/gallery/index-faces")
async def reindex_event_gallery_faces(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
    scope: Annotated[str, Query()] = "all",
) -> dict[str, int]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = _photos_for_index_scope(list_gallery_photos(event_id), scope)
    result: dict[str, int] = {"processed": 0, "thumbs_backfilled": 0, "indexed": 0, "no_face": 0, "failed": 0}
    set_event_gallery_indexing(event_id, True)
    try:
        for event in iter_gallery_face_index(event_id, photos):
            if event["type"] == "complete":
                result = {
                    "processed": event["processed"],
                    "thumbs_backfilled": event["thumbs_backfilled"],
                    "indexed": event["indexed"],
                    "no_face": event["no_face"],
                    "failed": event["failed"],
                }
    finally:
        set_event_gallery_indexing(event_id, False)
    _maybe_send_album_ready_email(event_id)
    return result


@router.post("/{event_id}/gallery/index-faces/stream")
async def reindex_event_gallery_faces_stream(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
    scope: Annotated[str, Query()] = "all",
) -> StreamingResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = _photos_for_index_scope(list_gallery_photos(event_id), scope)

    def generate() -> Any:
        set_event_gallery_indexing(event_id, True)
        try:
            for event in iter_gallery_face_index(event_id, photos):
                yield _ndjson_line(event)
                if event["type"] == "complete":
                    _maybe_send_album_ready_email(event_id)
        except Exception as exc:
            yield _ndjson_line({"type": "error", "message": str(exc)})
        finally:
            set_event_gallery_indexing(event_id, False)

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.post("/{event_id}/gallery/bulk-delete", response_model=GalleryBulkDeleteResponse)
async def bulk_remove_event_gallery_photos(
    event_id: str,
    body: GalleryBulkDeleteRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> GalleryBulkDeleteResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    deleted, not_found = bulk_delete_gallery_photos(event_id, body.photo_ids)
    if deleted == 0 and not_found > 0:
        raise HTTPException(status_code=404, detail="No matching photos found")
    return GalleryBulkDeleteResponse(deleted=deleted, not_found=not_found)


@router.patch("/{event_id}/gallery/{photo_id}/section", response_model=GalleryPhotoResponse)
async def set_gallery_photo_section(
    event_id: str,
    photo_id: str,
    body: GalleryPhotoSectionUpdate,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> GalleryPhotoResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = list_gallery_photos(event_id)
    if not any(p["id"] == photo_id for p in photos):
        raise HTTPException(status_code=404, detail="Photo not found")
    row = update_gallery_photo_section(photo_id, body.section.strip())
    return _gallery_photo_response(row, include_signed_url=True)


@router.get("/{event_id}/gallery/download")
async def download_event_gallery(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> StreamingResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = list_gallery_photos(event_id)
    if not photos:
        raise HTTPException(status_code=400, detail="Album is empty")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        used_names: set[str] = set()
        for index, photo in enumerate(photos):
            try:
                data = download_storage_bytes(photo["storage_path"])
            except Exception as exc:
                raise HTTPException(status_code=500, detail="Could not read gallery photo") from exc
            name = photo.get("filename") or f"photo_{index + 1}.jpg"
            if name in used_names:
                name = f"{index + 1}_{name}"
            used_names.add(name)
            archive.writestr(name, data)
    buffer.seek(0)
    event_row = fetch_event_by_id(event_id)
    slug = event_row["slug"] if event_row else event_id[:8]
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}-album.zip"'},
    )


@router.get("/{event_id}/stats", response_model=EventStatsResponse)
async def event_stats(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> EventStatsResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    stats = get_event_stats(event_id)
    return EventStatsResponse(**stats)


@router.get("/{event_id}/my-runs", response_model=list[MatchRunSummary])
async def my_event_match_runs(
    event_id: str,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
    anonymous_session_id: Annotated[str | None, Depends(get_anonymous_session_id)] = None,
) -> list[MatchRunSummary]:
    if user is None and not anonymous_session_id:
        return []
    rows = list_user_match_runs(event_id, user.id if user else None, anonymous_session_id)
    return [MatchRunSummary(**row) for row in rows]


@router.post("/{event_id}/gallery", response_model=GalleryPhotoResponse)
async def upload_event_gallery_photo(
    event_id: str,
    file: Annotated[UploadFile, File()],
    background_tasks: BackgroundTasks,
    user: Annotated[AuthUser, Depends(get_required_user)],
    section: Annotated[str, Form()] = "general",
) -> GalleryPhotoResponse:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")

    data = await _read_upload_limited(file)
    content_hash = hashlib.sha256(data).hexdigest()
    if find_gallery_photo_by_hash(event_id, content_hash):
        raise HTTPException(status_code=409, detail="This photo is already in the album")

    mime = file.content_type or "image/jpeg"
    photo_id = str(uuid.uuid4())
    existing = list_gallery_photos(event_id)
    row = upload_gallery_photo(
        event_id,
        photo_id,
        data,
        mime,
        user.id,
        file.filename,
        len(existing),
        content_hash,
        section.strip() or "general",
    )
    try:
        background_tasks.add_task(index_gallery_photo_faces, photo_id, row["storage_path"])
    except Exception:
        pass
    refreshed = fetch_gallery_photo_by_id(photo_id) or row
    return _gallery_photo_response(refreshed, include_signed_url=True)


@router.delete("/{event_id}/gallery/{photo_id}")
async def remove_event_gallery_photo(
    event_id: str,
    photo_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> dict[str, str]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = list_gallery_photos(event_id)
    target = next((p for p in photos if p["id"] == photo_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Photo not found")
    delete_gallery_photo(photo_id, target["storage_path"])
    return {"status": "deleted"}


@router.post("/{event_id}/members")
async def invite_event_member(
    event_id: str,
    email: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
    role: str = "co_admin",
) -> dict[str, str]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    if role not in ("admin", "co_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")
    invite_event_admin(email, event_id, event_row["slug"], role)
    return {"status": "invited", "email": email.strip().lower()}


@router.get("/{event_id}/setup-status", response_model=EventSetupStatusResponse)
async def get_event_setup_status(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> EventSetupStatusResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    row = fetch_event_by_id(event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_setup_status(event_id, row)


@router.patch("/{event_id}", response_model=EventPublicResponse)
async def patch_event(
    event_id: str,
    body: EventUpdateRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> EventPublicResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    payload = body.model_dump(exclude_unset=True)
    if payload.pop("complete_onboarding", None):
        payload["onboarding_completed_at"] = datetime.now(UTC).isoformat()
    if "branding" in payload and payload["branding"] is not None:
        existing = fetch_event_by_id(event_id)
        if existing:
            payload["branding"] = {**(existing.get("branding") or {}), **payload["branding"]}
    existing = fetch_event_by_id(event_id)
    previous_status = existing.get("status") if existing else None
    row = update_event(event_id, payload)
    if existing and payload.get("status") == "active" and previous_status != "active":
        branding = row.get("branding") or {}
        couple_names = branding.get("couple_names") or row.get("title") or "Your gallery"
        send_gallery_live_email(list_event_admin_emails(event_id), str(couple_names), row["slug"])
    return _event_public(row)


@router.get("/{event_id}/gallery/{photo_id}/image")
async def get_gallery_photo_image(
    event_id: str,
    photo_id: str,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
) -> dict[str, str | None]:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")

    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")

    _assert_event_available_for_match(event_row, event_id, user)

    photo = fetch_gallery_photo_by_id(photo_id)
    if not photo or photo.get("event_id") != event_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    signed_url = create_gallery_signed_url(photo["storage_path"])
    if not signed_url:
        raise HTTPException(status_code=500, detail="Could not create image URL")

    return {
        "signed_url": signed_url,
        "mime_type": photo.get("mime_type") or "image/jpeg",
        "filename": photo.get("filename"),
    }


@router.post("/{event_id}/match/stream")
async def match_event_gallery_stream(
    request: Request,
    event_id: str,
    selfie: Annotated[UploadFile, File()],
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float | None, Form()] = None,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
    anonymous_session_id: Annotated[str | None, Depends(get_anonymous_session_id)] = None,
) -> StreamingResponse:
    enforce_match_rate_limit(request, event_id, anonymous_session_id)
    _, references, couple_mode, effective_threshold, gallery = await _prepare_event_match_context(
        event_id, selfie, partner_selfie, threshold, user
    )

    def generate() -> Any:
        try:
            for event in iter_event_gallery_matches(
                event_id,
                gallery,
                references,
                couple_mode,
                effective_threshold,
                user_id=user.id if user else None,
                anonymous_session_id=anonymous_session_id,
            ):
                yield _ndjson_line(event)
        except Exception as exc:
            yield _ndjson_line({"type": "error", "message": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.post("/{event_id}/match", response_model=MatchResponse)
async def match_event_gallery(
    request: Request,
    event_id: str,
    selfie: Annotated[UploadFile, File()],
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float | None, Form()] = None,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
    anonymous_session_id: Annotated[str | None, Depends(get_anonymous_session_id)] = None,
) -> MatchResponse:
    enforce_match_rate_limit(request, event_id, anonymous_session_id)
    _, references, couple_mode, effective_threshold, gallery = await _prepare_event_match_context(
        event_id, selfie, partner_selfie, threshold, user
    )

    result: MatchResponse | None = None
    for event in iter_event_gallery_matches(
        event_id,
        gallery,
        references,
        couple_mode,
        effective_threshold,
        user_id=user.id if user else None,
        anonymous_session_id=anonymous_session_id,
    ):
        if event["type"] == "complete":
            result = MatchResponse(**event["result"])

    if result is None:
        raise HTTPException(status_code=500, detail="Match did not complete")
    return result
