from __future__ import annotations

import base64
from typing import Any, Iterator

from snapic.db.repository import (
    download_gallery_thumbnail_bytes,
    download_storage_bytes,
    index_gallery_photo_faces,
    upload_gallery_thumbnail,
)
from snapic.face.images import decode_image_bytes, encode_thumbnail_base64


def _backfill_thumbnail(event_id: str, photo: dict[str, Any]) -> bool:
    if download_gallery_thumbnail_bytes(event_id, photo["id"]) is not None:
        return False
    try:
        data = download_storage_bytes(photo["storage_path"])
        image_bgr = decode_image_bytes(data)
        thumb_bytes = base64.b64decode(encode_thumbnail_base64(image_bgr))
        upload_gallery_thumbnail(event_id, photo["id"], thumb_bytes)
        return True
    except Exception:
        return False


def iter_gallery_face_index(
    event_id: str,
    photos: list[dict[str, Any]],
) -> Iterator[dict[str, Any]]:
    """Yield NDJSON-style progress events while indexing gallery face embeddings."""
    indexed_photos = [p for p in photos if p.get("face_index_status") == "indexed"]
    pending_photos = [p for p in photos if p.get("face_index_status") != "indexed"]
    total_work = len(indexed_photos) + len(pending_photos)

    processed = 0
    indexed_count = 0
    no_face_count = 0
    failed_count = 0
    thumbs_backfilled = 0

    yield {
        "type": "progress",
        "processed": 0,
        "total": total_work,
        "indexed": 0,
        "no_face": 0,
        "failed": 0,
        "thumbs_backfilled": 0,
    }

    for photo in indexed_photos:
        if _backfill_thumbnail(event_id, photo):
            thumbs_backfilled += 1
        processed += 1
        yield {
            "type": "progress",
            "processed": processed,
            "total": total_work,
            "indexed": indexed_count,
            "no_face": no_face_count,
            "failed": failed_count,
            "thumbs_backfilled": thumbs_backfilled,
        }

    for photo in pending_photos:
        status = index_gallery_photo_faces(photo["id"], photo["storage_path"])
        processed += 1
        if status == "indexed":
            indexed_count += 1
        elif status == "no_face":
            no_face_count += 1
        else:
            failed_count += 1
        yield {
            "type": "progress",
            "processed": processed,
            "total": total_work,
            "indexed": indexed_count,
            "no_face": no_face_count,
            "failed": failed_count,
            "thumbs_backfilled": thumbs_backfilled,
        }

    yield {
        "type": "complete",
        "processed": len(pending_photos),
        "indexed": indexed_count,
        "no_face": no_face_count,
        "failed": failed_count,
        "thumbs_backfilled": thumbs_backfilled,
    }
