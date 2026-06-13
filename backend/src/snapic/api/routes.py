from __future__ import annotations

import json
from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from snapic.api.schemas import HealthResponse, MatchResponse, MatchedPhoto, SharedMatchResponse, SkippedPhoto
from snapic.api.share_store import share_store
from snapic.face.images import (
    decode_image_bytes,
    detect_image_mime,
    encode_image_base64,
    encode_original_base64,
    encode_thumbnail_base64,
)
from snapic.face.pipeline import (
    NoFaceInSelfieError,
    evaluate_gallery_image,
    extract_reference_embedding,
)

router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
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


def _process_gallery_image(
    image_bgr: np.ndarray,
    image_bytes: bytes,
    references: list[np.ndarray],
    couple_mode: bool,
    threshold: float,
    *,
    source: str,
    index: int,
    filename: str | None = None,
    url: str | None = None,
) -> tuple[MatchedPhoto | None, SkippedPhoto | None]:
    evaluation = evaluate_gallery_image(references, image_bgr, threshold, couple_mode)
    if not evaluation.had_faces:
        return None, SkippedPhoto(
            source=source,
            index=index,
            reason="no_face_detected",
            filename=filename,
            url=url,
        )

    if evaluation.score is None:
        return None, None

    matched_person = evaluation.matched_person if couple_mode else None
    image_mime = detect_image_mime(image_bytes)
    try:
        image_base64 = encode_original_base64(image_bytes)
    except Exception:
        image_base64 = encode_image_base64(image_bgr)
        image_mime = "image/jpeg"

    return (
        MatchedPhoto(
            source=source,
            index=index,
            filename=filename,
            url=url,
            score=round(evaluation.score, 4),
            preview_base64=encode_thumbnail_base64(image_bgr),
            image_base64=image_base64,
            image_mime=image_mime,
            matched_person=matched_person,
        ),
        None,
    )


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/share/{share_id}", response_model=SharedMatchResponse)
async def get_shared_results(share_id: str) -> SharedMatchResponse:
    stored = share_store.get(share_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Shared results not found or expired")
    return SharedMatchResponse(**stored.model_dump(), share_id=share_id)


@router.post("/match", response_model=MatchResponse)
async def match_faces(
    selfie: Annotated[UploadFile, File()],
    gallery_files: Annotated[list[UploadFile] | None, File()] = None,
    gallery_urls: Annotated[str | None, Form()] = None,
    partner_selfie: Annotated[UploadFile | None, File()] = None,
    threshold: Annotated[float, Form()] = DEFAULT_THRESHOLD,
) -> MatchResponse:
    if threshold < 0.0 or threshold > 1.0:
        raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")

    urls = _parse_gallery_urls(gallery_urls)
    files = gallery_files or []

    if not files and not urls:
        raise HTTPException(status_code=400, detail="Provide at least one gallery file or URL")

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

        match, skip = _process_gallery_image(
            image_bgr,
            image_bytes,
            references,
            couple_mode,
            threshold,
            source="upload",
            index=index,
            filename=filename,
        )
        if match:
            matched.append(match)
        elif skip:
            skipped.append(skip)

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

        match, skip = _process_gallery_image(
            image_bgr,
            image_bytes,
            references,
            couple_mode,
            threshold,
            source="url",
            index=index,
            url=url,
        )
        if match:
            matched.append(match)
        elif skip:
            skipped.append(skip)

    matched.sort(key=lambda item: item.score, reverse=True)

    response = MatchResponse(
        reference_face_detected=True,
        threshold=threshold,
        total_gallery=len(files) + len(urls),
        matched=matched,
        skipped=skipped,
        couple_mode=couple_mode,
    )
    share_id = share_store.save(response)
    response.share_id = share_id
    return response
