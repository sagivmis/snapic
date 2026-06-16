from __future__ import annotations

import base64
import hashlib
import io
import uuid
import zipfile
from typing import Annotated, Any

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from snapic.api.schemas import (
    EventPublicResponse,
    EventStatsResponse,
    EventUpdateRequest,
    GalleryPhotoResponse,
    GalleryPhotoSectionUpdate,
    MatchResponse,
    MatchRunSummary,
    MatchedPhoto,
    SkippedPhoto,
    UserEventSummary,
)
from snapic.auth.jwt import AuthUser, get_anonymous_session_id, get_optional_user, get_required_user
from snapic.db import is_supabase_configured
from snapic.db.invites import invite_event_admin
from snapic.db.repository import (
    count_gallery_photos,
    create_gallery_signed_url,
    create_match_run,
    create_share_token,
    delete_gallery_photo,
    download_storage_bytes,
    fetch_event_by_id,
    fetch_event_by_slug,
    fetch_gallery_photo_by_id,
    find_gallery_photo_by_hash,
    get_event_stats,
    index_gallery_photo_faces,
    is_event_admin,
    list_gallery_photos,
    list_gallery_sections,
    list_user_events,
    list_user_match_runs,
    maybe_auto_archive_event,
    save_match_results,
    update_event,
    update_gallery_face_index,
    update_gallery_photo_section,
    upload_gallery_photo,
    upload_preview_bytes,
)
from snapic.face.images import decode_image_bytes, encode_thumbnail_base64
from snapic.face.gallery_match import (
    evaluate_photo_for_match,
    evaluate_photo_match,
    load_photo_face_embeddings,
    serialize_face_embeddings_for_db,
)
from snapic.face.pipeline import NoFaceInSelfieError, extract_reference_embedding

router = APIRouter(prefix="/events", tags=["events"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_THRESHOLD = 0.4


async def _read_upload_limited(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"Image too large: {upload.filename}")
    return data


def _event_public(row: dict[str, Any]) -> EventPublicResponse:
    row = maybe_auto_archive_event(row)
    branding = row.get("branding") or {}
    return EventPublicResponse(
        id=row["id"],
        slug=row["slug"],
        title=row["title"],
        wedding_date=row.get("wedding_date"),
        status=row["status"],
        branding=branding,
        default_threshold=row.get("default_threshold", 0.4),
        gallery_photo_count=count_gallery_photos(row["id"]),
        auto_archive_days=int(row.get("auto_archive_days") or 90),
    )


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
) -> list[GalleryPhotoResponse]:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")
    photos = list_gallery_photos(event_id)
    is_admin = user is not None and is_event_admin(user.id, event_id)
    return [_gallery_photo_response(p, include_signed_url=is_admin) for p in photos]


@router.get("/{event_id}/gallery/sections", response_model=list[str])
async def list_event_gallery_sections(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> list[str]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    return list_gallery_sections(event_id)


@router.post("/{event_id}/gallery/index-faces")
async def reindex_event_gallery_faces(
    event_id: str,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> dict[str, int]:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    photos = list_gallery_photos(event_id)
    processed = 0
    for photo in photos:
        if photo.get("face_index_status") == "indexed":
            continue
        index_gallery_photo_faces(photo["id"], photo["storage_path"])
        processed += 1
    return {"processed": processed}


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
        index_gallery_photo_faces(photo_id, row["storage_path"])
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


@router.patch("/{event_id}", response_model=EventPublicResponse)
async def patch_event(
    event_id: str,
    body: EventUpdateRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> EventPublicResponse:
    if not is_event_admin(user.id, event_id):
        raise HTTPException(status_code=403, detail="Event admin access required")
    payload = body.model_dump(exclude_unset=True)
    row = update_event(event_id, payload)
    return _event_public(row)


@router.post("/{event_id}/match", response_model=MatchResponse)
async def match_event_gallery(
    event_id: str,
    selfie: Annotated[UploadFile, File()],
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float | None, Form()] = None,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
    anonymous_session_id: Annotated[str | None, Depends(get_anonymous_session_id)] = None,
) -> MatchResponse:
    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Event service not configured")

    event_row = fetch_event_by_id(event_id)
    if not event_row:
        raise HTTPException(status_code=404, detail="Event not found")

    event_row = maybe_auto_archive_event(event_row)
    status = event_row["status"]
    if status == "archived":
        raise HTTPException(status_code=403, detail="This event has ended")
    if status == "draft":
        if user is None or not is_event_admin(user.id, event_id):
            raise HTTPException(status_code=403, detail="Event not active yet")
    elif status != "active":
        raise HTTPException(status_code=403, detail="Event is not available")

    effective_threshold = threshold if threshold is not None else event_row.get("default_threshold", DEFAULT_THRESHOLD)
    if effective_threshold < 0.0 or effective_threshold > 1.0:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    gallery = list_gallery_photos(event_id)
    if not gallery:
        raise HTTPException(status_code=400, detail="Album still uploading — check back soon")

    selfie_bytes = await _read_upload_limited(selfie)
    try:
        selfie_image = decode_image_bytes(selfie_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not decode selfie image") from exc

    try:
        references: list[np.ndarray] = [extract_reference_embedding(selfie_image)]
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

    matched: list[MatchedPhoto] = []
    skipped: list[SkippedPhoto] = []
    db_matched: list[dict[str, Any]] = []
    db_skipped: list[dict[str, Any]] = []

    for index, photo in enumerate(gallery):
        filename = photo.get("filename") or f"photo_{index}"
        precomputed = load_photo_face_embeddings(photo)

        try:
            if precomputed is not None:
                evaluation = evaluate_photo_match(references, precomputed, effective_threshold, couple_mode)
                if not evaluation.had_faces:
                    skipped.append(
                        SkippedPhoto(source="upload", index=index, reason="no_face_detected", filename=filename)
                    )
                    db_skipped.append(
                        {
                            "match_run_id": "",
                            "gallery_photo_id": photo["id"],
                            "reason": "no_face_detected",
                            "filename": filename,
                            "sort_index": index,
                        }
                    )
                    continue
                if evaluation.score is None:
                    continue
                image_bytes = download_storage_bytes(photo["storage_path"])
            else:
                image_bytes = download_storage_bytes(photo["storage_path"])
                image_bgr = decode_image_bytes(image_bytes)
                evaluation, embeddings, index_status = evaluate_photo_for_match(
                    references, image_bgr, effective_threshold, couple_mode
                )
                update_gallery_face_index(
                    photo["id"],
                    serialize_face_embeddings_for_db(embeddings) if index_status == "indexed" else [],
                    index_status,
                )
                if not evaluation.had_faces:
                    skipped.append(
                        SkippedPhoto(source="upload", index=index, reason="no_face_detected", filename=filename)
                    )
                    db_skipped.append(
                        {
                            "match_run_id": "",
                            "gallery_photo_id": photo["id"],
                            "reason": "no_face_detected",
                            "filename": filename,
                            "sort_index": index,
                        }
                    )
                    continue
                if evaluation.score is None:
                    continue
        except Exception:
            skipped.append(
                SkippedPhoto(source="upload", index=index, reason="decode_failed", filename=filename)
            )
            db_skipped.append(
                {"match_run_id": "", "gallery_photo_id": photo["id"], "reason": "decode_failed", "filename": filename, "sort_index": index}
            )
            continue

        image_bgr = decode_image_bytes(image_bytes)

        preview_b64 = encode_thumbnail_base64(image_bgr)
        preview_bytes = base64.b64decode(preview_b64)
        result_id = str(uuid.uuid4())
        preview_path = upload_preview_bytes(event_id, result_id, preview_bytes)

        matched_person = evaluation.matched_person if couple_mode else None
        mp = MatchedPhoto(
            source="upload",
            index=index,
            filename=filename,
            score=round(evaluation.score, 4),
            preview_base64=preview_b64,
            image_base64=base64.b64encode(image_bytes).decode("ascii"),
            image_mime=photo.get("mime_type", "image/jpeg"),
            matched_person=matched_person,
            person_1_score=evaluation.person_1_score if couple_mode else None,
            person_2_score=evaluation.person_2_score if couple_mode else None,
        )
        matched.append(mp)
        db_matched.append(
            {
                "id": result_id,
                "match_run_id": "",
                "gallery_photo_id": photo["id"],
                "score": mp.score,
                "matched_person": matched_person,
                "person_1_score": mp.person_1_score,
                "person_2_score": mp.person_2_score,
                "preview_path": preview_path,
                "filename": filename,
                "sort_index": index,
            }
        )

    matched.sort(key=lambda item: item.score, reverse=True)

    user_id = user.id if user else None
    run_id = create_match_run(
        event_id=event_id,
        user_id=user_id,
        anonymous_session_id=anonymous_session_id,
        couple_mode=couple_mode,
        threshold=effective_threshold,
        total_gallery=len(gallery),
        matched_count=len(matched),
        skipped_count=len(skipped),
    )
    for row in db_matched:
        row["match_run_id"] = run_id
    for row in db_skipped:
        row["match_run_id"] = run_id
    save_match_results(run_id, db_matched, db_skipped)
    share_id = create_share_token(run_id)

    return MatchResponse(
        reference_face_detected=True,
        threshold=effective_threshold,
        total_gallery=len(gallery),
        matched=matched,
        skipped=skipped,
        couple_mode=couple_mode,
        share_id=share_id,
        event_id=event_id,
        match_run_id=run_id,
    )
