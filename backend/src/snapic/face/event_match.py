from __future__ import annotations

import base64
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Iterator

import numpy as np

from snapic.api.schemas import MatchResponse, MatchedPhoto, SkippedPhoto
from snapic.db.repository import (
    create_match_run,
    create_share_token,
    download_gallery_thumbnail_bytes,
    download_storage_bytes,
    save_match_results,
    update_gallery_face_index,
    upload_gallery_thumbnail,
)
from snapic.face.gallery_match import (
    evaluate_photo_for_match,
    evaluate_photo_match,
    load_photo_face_embeddings,
    serialize_embeddings_for_db,
)
from snapic.face.images import decode_image_bytes, encode_thumbnail_base64

MATCH_BATCH_SIZE = 32
MATCH_WORKERS = max(1, min(int(os.getenv("SNAPIC_MATCH_WORKERS", "4")), 8))


def _match_preview_for_photo(
    event_id: str,
    photo: dict[str, Any],
    image_bgr: np.ndarray | None = None,
) -> tuple[str, str]:
    """Return (preview_base64, preview_storage_path) using cached thumbnail when possible."""
    photo_id = photo["id"]
    thumb_bytes = download_gallery_thumbnail_bytes(event_id, photo_id)
    if thumb_bytes is None:
        if image_bgr is None:
            image_bytes = download_storage_bytes(photo["storage_path"])
            image_bgr = decode_image_bytes(image_bytes)
        preview_b64 = encode_thumbnail_base64(image_bgr)
        thumb_bytes = base64.b64decode(preview_b64)
        upload_gallery_thumbnail(event_id, photo_id, thumb_bytes)
    else:
        preview_b64 = base64.b64encode(thumb_bytes).decode("ascii")

    preview_path = f"{event_id}/thumbnails/{photo_id}.jpg"
    return preview_b64, preview_path


def _evaluate_indexed_photo(
    index: int,
    photo: dict[str, Any],
    references: list[np.ndarray],
    threshold: float,
    couple_mode: bool,
) -> dict[str, Any]:
    filename = photo.get("filename") or f"photo_{index}"
    precomputed = load_photo_face_embeddings(photo)
    if precomputed is None:
        return {"index": index, "photo": photo, "filename": filename, "kind": "unindexed"}

    if not precomputed:
        return {
            "index": index,
            "photo": photo,
            "filename": filename,
            "kind": "skipped",
            "reason": "no_face_detected",
        }

    evaluation = evaluate_photo_match(references, precomputed, threshold, couple_mode)
    if evaluation.score is None:
        return {"index": index, "photo": photo, "filename": filename, "kind": "below_threshold"}

    return {
        "index": index,
        "photo": photo,
        "filename": filename,
        "kind": "match",
        "evaluation": evaluation,
    }


def _append_match(
    event_id: str,
    index: int,
    photo: dict[str, Any],
    filename: str,
    evaluation: Any,
    couple_mode: bool,
    matched: list[MatchedPhoto],
    db_matched: list[dict[str, Any]],
    image_bgr: np.ndarray | None = None,
) -> MatchedPhoto:
    preview_b64, preview_path = _match_preview_for_photo(event_id, photo, image_bgr)
    result_id = str(uuid.uuid4())
    matched_person = evaluation.matched_person if couple_mode else None
    mp = MatchedPhoto(
        source="upload",
        index=index,
        filename=filename,
        score=round(evaluation.score, 4),
        preview_base64=preview_b64,
        image_base64=None,
        image_mime=photo.get("mime_type", "image/jpeg"),
        matched_person=matched_person,
        person_1_score=evaluation.person_1_score if couple_mode else None,
        person_2_score=evaluation.person_2_score if couple_mode else None,
        gallery_photo_id=photo["id"],
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
    return mp


def iter_event_gallery_matches(
    event_id: str,
    gallery: list[dict[str, Any]],
    references: list[np.ndarray],
    couple_mode: bool,
    threshold: float,
    *,
    user_id: str | None,
    anonymous_session_id: str | None,
) -> Iterator[dict[str, Any]]:
    matched: list[MatchedPhoto] = []
    skipped: list[SkippedPhoto] = []
    db_matched: list[dict[str, Any]] = []
    db_skipped: list[dict[str, Any]] = []
    total = len(gallery)

    yield {"type": "progress", "processed": 0, "total": total, "matched_count": 0}

    processed = 0
    for batch_start in range(0, total, MATCH_BATCH_SIZE):
        batch = list(enumerate(gallery[batch_start : batch_start + MATCH_BATCH_SIZE], start=batch_start))
        batch_results: list[dict[str, Any]] = []

        with ThreadPoolExecutor(max_workers=MATCH_WORKERS) as pool:
            futures = [
                pool.submit(_evaluate_indexed_photo, index, photo, references, threshold, couple_mode)
                for index, photo in batch
            ]
            for future in futures:
                batch_results.append(future.result())

        batch_results.sort(key=lambda item: item["index"])

        for item in batch_results:
            index = item["index"]
            photo = item["photo"]
            filename = item["filename"]
            kind = item["kind"]

            if kind == "unindexed":
                image_bgr: np.ndarray | None = None
                try:
                    image_bytes = download_storage_bytes(photo["storage_path"])
                    image_bgr = decode_image_bytes(image_bytes)
                    evaluation, embeddings, index_status = evaluate_photo_for_match(
                        references, image_bgr, threshold, couple_mode
                    )
                    update_gallery_face_index(
                        photo["id"],
                        serialize_embeddings_for_db(embeddings) if index_status == "indexed" else [],
                        index_status,
                    )
                    if not evaluation.had_faces:
                        skipped.append(
                            SkippedPhoto(
                                source="upload", index=index, reason="no_face_detected", filename=filename
                            )
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
                    elif evaluation.score is not None:
                        mp = _append_match(
                            event_id,
                            index,
                            photo,
                            filename,
                            evaluation,
                            couple_mode,
                            matched,
                            db_matched,
                            image_bgr,
                        )
                        yield {"type": "match", "photo": mp.model_dump()}
                except Exception:
                    skipped.append(
                        SkippedPhoto(source="upload", index=index, reason="decode_failed", filename=filename)
                    )
                    db_skipped.append(
                        {
                            "match_run_id": "",
                            "gallery_photo_id": photo["id"],
                            "reason": "decode_failed",
                            "filename": filename,
                            "sort_index": index,
                        }
                    )
            elif kind == "skipped":
                skipped.append(
                    SkippedPhoto(
                        source="upload",
                        index=index,
                        reason=item["reason"],
                        filename=filename,
                    )
                )
                db_skipped.append(
                    {
                        "match_run_id": "",
                        "gallery_photo_id": photo["id"],
                        "reason": item["reason"],
                        "filename": filename,
                        "sort_index": index,
                    }
                )
            elif kind == "match":
                mp = _append_match(
                    event_id,
                    index,
                    photo,
                    filename,
                    item["evaluation"],
                    couple_mode,
                    matched,
                    db_matched,
                )
                yield {"type": "match", "photo": mp.model_dump()}

            processed += 1
            yield {
                "type": "progress",
                "processed": processed,
                "total": total,
                "matched_count": len(matched),
            }

    matched.sort(key=lambda item: item.score, reverse=True)

    run_id = create_match_run(
        event_id=event_id,
        user_id=user_id,
        anonymous_session_id=anonymous_session_id,
        couple_mode=couple_mode,
        threshold=threshold,
        total_gallery=total,
        matched_count=len(matched),
        skipped_count=len(skipped),
    )
    for row in db_matched:
        row["match_run_id"] = run_id
    for row in db_skipped:
        row["match_run_id"] = run_id
    save_match_results(run_id, db_matched, db_skipped)
    share_id = create_share_token(run_id)

    result = MatchResponse(
        reference_face_detected=True,
        threshold=threshold,
        total_gallery=total,
        matched=matched,
        skipped=skipped,
        couple_mode=couple_mode,
        share_id=share_id,
        event_id=event_id,
        match_run_id=run_id,
    )
    yield {"type": "complete", "result": result.model_dump()}
