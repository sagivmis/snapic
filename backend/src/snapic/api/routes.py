from __future__ import annotations

import json
from typing import Annotated, Any

import httpx
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from snapic.api.schemas import (
    HealthResponse,
    MatchResponse,
    PortraitQualityResponse,
    SharedMatchResponse,
    SignupRequestCreate,
    SignupRequestResponse,
    SkippedPhoto,
)
from snapic.api.share_store import share_store
from snapic.face.demo_match import DemoGalleryImage, iter_demo_gallery_matches
from snapic.face.images import decode_image_bytes
from snapic.face.pipeline import (
    NoFaceInSelfieError,
    extract_reference_embedding,
)
from snapic.api.rate_limit import enforce_signup_rate_limit
from snapic.auth.jwt import AuthUser, get_required_user

router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_DEMO_GALLERY_PHOTOS = 50
DEFAULT_THRESHOLD = 0.4


async def _read_upload_limited(upload: UploadFile) -> bytes:
    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"Image too large: {upload.filename}")
    return data


async def _fetch_url_image(url: str) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {url}") from exc

    content_type = response.headers.get("content-type", "")
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"URL is not an image: {url}")

    if len(response.content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"Image too large from URL: {url}")

    return response.content


def _parse_gallery_urls(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="gallery_urls must be a JSON array of strings") from exc
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise HTTPException(status_code=400, detail="gallery_urls must be a JSON array of strings")
    return [url.strip() for url in parsed if url.strip()]


def _ndjson_line(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload) + "\n").encode("utf-8")


async def _load_legacy_gallery(
    files: list[UploadFile],
    urls: list[str],
) -> tuple[list[DemoGalleryImage], list[SkippedPhoto]]:
    gallery: list[DemoGalleryImage] = []
    skipped: list[SkippedPhoto] = []

    for index, upload in enumerate(files):
        filename = upload.filename or f"upload_{index}"
        try:
            image_bytes = await _read_upload_limited(upload)
            image_bgr = decode_image_bytes(image_bytes)
        except HTTPException:
            raise
        except Exception:
            skipped.append(
                SkippedPhoto(
                    source="upload",
                    index=index,
                    reason="decode_failed",
                    filename=filename,
                )
            )
            continue
        gallery.append(
            DemoGalleryImage(
                source="upload",
                index=index,
                filename=filename,
                url=None,
                image_bgr=image_bgr,
                image_bytes=image_bytes,
            )
        )

    for index, url in enumerate(urls):
        try:
            image_bytes = await _fetch_url_image(url)
            image_bgr = decode_image_bytes(image_bytes)
        except HTTPException as exc:
            reason = "fetch_failed"
            if "not an image" in str(exc.detail):
                reason = "not_an_image"
            skipped.append(
                SkippedPhoto(
                    source="url",
                    index=index,
                    reason=reason,
                    url=url,
                )
            )
            continue
        except Exception:
            skipped.append(
                SkippedPhoto(
                    source="url",
                    index=index,
                    reason="decode_failed",
                    url=url,
                )
            )
            continue
        gallery.append(
            DemoGalleryImage(
                source="url",
                index=index,
                filename=None,
                url=url,
                image_bgr=image_bgr,
                image_bytes=image_bytes,
            )
        )

    return gallery, skipped


async def _prepare_legacy_match(
    selfie: UploadFile,
    gallery_files: list[UploadFile] | None,
    gallery_urls: str | None,
    partner_selfie: UploadFile | None,
    threshold: float,
) -> tuple[list[np.ndarray], bool, float, list[DemoGalleryImage], list[SkippedPhoto], int]:
    if threshold < 0.0 or threshold > 1.0:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    urls = _parse_gallery_urls(gallery_urls)
    files = gallery_files or []
    if not files and not urls:
        raise HTTPException(status_code=400, detail="Provide at least one gallery file or URL")
    if len(files) + len(urls) > MAX_DEMO_GALLERY_PHOTOS:
        raise HTTPException(
            status_code=400,
            detail=f"Demo gallery is limited to {MAX_DEMO_GALLERY_PHOTOS} photos",
        )

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

    gallery, skipped = await _load_legacy_gallery(files, urls)
    return references, couple_mode, threshold, gallery, skipped, len(files) + len(urls)


def _finalize_legacy_match(
    references: list[np.ndarray],
    couple_mode: bool,
    threshold: float,
    gallery: list[DemoGalleryImage],
    pre_skipped: list[SkippedPhoto],
    total_gallery: int,
) -> MatchResponse:
    for event in iter_demo_gallery_matches(
        gallery,
        references,
        couple_mode,
        threshold,
        total_gallery=total_gallery,
        pre_skipped=pre_skipped,
    ):
        if event["type"] == "complete":
            return MatchResponse(**event["result"])
    raise HTTPException(status_code=500, detail="Match did not complete")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    checks: dict[str, str] = {"api": "ok"}
    status = "ok"
    try:
        from snapic.db import is_supabase_configured, get_supabase

        if is_supabase_configured():
            client = get_supabase()
            client.table("events").select("id", count="exact").limit(1).execute()
            checks["database"] = "ok"
        else:
            checks["database"] = "not_configured"
    except Exception as exc:
        checks["database"] = f"error:{exc.__class__.__name__}"
        status = "degraded"
    return HealthResponse(status=status, checks=checks)


@router.post("/signup-requests", response_model=SignupRequestResponse)
async def public_create_signup_request(
    request: Request,
    body: SignupRequestCreate,
) -> SignupRequestResponse:
    from snapic.db import is_supabase_configured
    from snapic.db.affiliates import get_active_affiliate_by_code, normalize_affiliate_code
    from snapic.db.repository import create_signup_request

    enforce_signup_rate_limit(request)

    if not is_supabase_configured():
        raise HTTPException(status_code=503, detail="Signup not configured")

    payload = body.model_dump()
    referral_code = payload.get("referral_code")
    if referral_code:
        normalized = normalize_affiliate_code(referral_code)
        if not get_active_affiliate_by_code(normalized):
            payload["referral_code"] = None
        else:
            payload["referral_code"] = normalized

    row = create_signup_request(payload)
    return SignupRequestResponse(
        id=row["id"],
        email=row["email"],
        couple_names=row.get("couple_names") or "",
        wedding_date=row.get("wedding_date"),
        message=row.get("message"),
        status=row["status"],
        request_type=row.get("request_type") or "couple",
        organization_name=row.get("organization_name"),
        referral_code=row.get("referral_code"),
        created_at=row.get("created_at"),
    )


@router.delete("/me")
async def delete_my_account(user: Annotated[AuthUser, Depends(get_required_user)]) -> dict[str, str]:
    from snapic.db.repository import delete_user_account

    try:
        delete_user_account(user.id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not delete account") from exc
    return {"status": "deleted"}


@router.post("/validate-portrait", response_model=PortraitQualityResponse)
async def validate_portrait(portrait: Annotated[UploadFile, File()]) -> PortraitQualityResponse:
    portrait_bytes = await _read_upload_limited(portrait)
    try:
        image_bgr = decode_image_bytes(portrait_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not decode portrait image") from exc

    result = analyze_portrait(image_bgr)
    return PortraitQualityResponse(
        face_detected=result.face_detected,
        warnings=result.warnings,
        face_count=result.face_count,
    )


@router.get("/share/{share_id}", response_model=SharedMatchResponse)
async def get_shared_results(share_id: str) -> SharedMatchResponse:
    from snapic.db import is_supabase_configured
    from snapic.db.repository import get_share_token, load_match_response_from_run

    if is_supabase_configured():
        token_row = get_share_token(share_id)
        if token_row:
            payload = load_match_response_from_run(token_row["match_run_id"])
            if payload:
                return SharedMatchResponse(**{**payload, "share_id": share_id})

    stored = share_store.get(share_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Shared results not found or expired")
    return SharedMatchResponse(**{**stored.model_dump(), "share_id": share_id})


@router.post("/match", response_model=MatchResponse)
async def match_faces(
    selfie: Annotated[UploadFile, File()],
    gallery_files: Annotated[list[UploadFile] | None, File()] = None,
    gallery_urls: Annotated[str | None, Form()] = None,
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float, Form()] = DEFAULT_THRESHOLD,
) -> MatchResponse:
    references, couple_mode, effective_threshold, gallery, pre_skipped, total_gallery = (
        await _prepare_legacy_match(selfie, gallery_files, gallery_urls, partner_selfie, threshold)
    )
    return _finalize_legacy_match(
        references,
        couple_mode,
        effective_threshold,
        gallery,
        pre_skipped,
        total_gallery,
    )


@router.post("/match/stream")
async def match_faces_stream(
    selfie: Annotated[UploadFile, File()],
    gallery_files: Annotated[list[UploadFile] | None, File()] = None,
    gallery_urls: Annotated[str | None, Form()] = None,
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float, Form()] = DEFAULT_THRESHOLD,
) -> StreamingResponse:
    references, couple_mode, effective_threshold, gallery, pre_skipped, total_gallery = (
        await _prepare_legacy_match(selfie, gallery_files, gallery_urls, partner_selfie, threshold)
    )

    def generate() -> Any:
        try:
            for event in iter_demo_gallery_matches(
                gallery,
                references,
                couple_mode,
                effective_threshold,
                total_gallery=total_gallery,
                pre_skipped=pre_skipped,
            ):
                yield _ndjson_line(event)
        except Exception as exc:
            yield _ndjson_line({"type": "error", "message": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")
