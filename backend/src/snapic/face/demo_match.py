from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

import numpy as np

from snapic.api.schemas import MatchResponse, MatchedPhoto, SkippedPhoto
from snapic.api.share_store import share_store
from snapic.face.images import (
    decode_image_bytes,
    detect_image_mime,
    encode_image_base64,
    encode_original_base64,
    encode_thumbnail_base64,
)
from snapic.face.pipeline import evaluate_gallery_image


@dataclass(frozen=True)
class DemoGalleryImage:
    source: str
    index: int
    filename: str | None
    url: str | None
    image_bgr: np.ndarray
    image_bytes: bytes


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
    person_1_score = evaluation.person_1_score if couple_mode else None
    person_2_score = evaluation.person_2_score if couple_mode else None
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
            person_1_score=person_1_score,
            person_2_score=person_2_score,
        ),
        None,
    )


def iter_demo_gallery_matches(
    gallery: list[DemoGalleryImage],
    references: list[np.ndarray],
    couple_mode: bool,
    threshold: float,
    *,
    total_gallery: int | None = None,
    pre_skipped: list[SkippedPhoto] | None = None,
) -> Iterator[dict[str, Any]]:
    matched: list[MatchedPhoto] = []
    skipped: list[SkippedPhoto] = list(pre_skipped or [])
    total = total_gallery if total_gallery is not None else len(gallery)

    yield {"type": "progress", "processed": 0, "total": total, "matched_count": 0}

    processed = 0
    for item in gallery:
        match, skip = _process_gallery_image(
            item.image_bgr,
            item.image_bytes,
            references,
            couple_mode,
            threshold,
            source=item.source,
            index=item.index,
            filename=item.filename,
            url=item.url,
        )
        if match:
            matched.append(match)
            yield {"type": "match", "photo": match.model_dump()}
        elif skip:
            skipped.append(skip)

        processed += 1
        yield {
            "type": "progress",
            "processed": processed,
            "total": total,
            "matched_count": len(matched),
        }

    matched.sort(key=lambda row: row.score, reverse=True)

    response = MatchResponse(
        reference_face_detected=True,
        threshold=threshold,
        total_gallery=total,
        matched=matched,
        skipped=skipped,
        couple_mode=couple_mode,
    )
    share_id = share_store.save(response)
    response.share_id = share_id
    yield {"type": "complete", "result": response.model_dump()}
