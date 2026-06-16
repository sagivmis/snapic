from __future__ import annotations

from typing import Any

import numpy as np

from snapic.face.images import decode_image_bytes
from snapic.face.indexing import detect_face_embeddings, embeddings_from_json, embeddings_to_json
from snapic.face.pipeline import GalleryMatchEvaluation, evaluate_gallery_match


def load_photo_face_embeddings(photo: dict[str, Any]) -> list[np.ndarray] | None:
    """Return embeddings, empty list (no face), or None if not indexed yet."""
    status = photo.get("face_index_status")
    if status == "no_face":
        return []
    if status == "indexed":
        return embeddings_from_json(photo.get("face_embeddings"))
    return None


def evaluate_photo_match(
    references: list[np.ndarray],
    face_embeddings: list[np.ndarray],
    threshold: float,
    couple_mode: bool,
) -> GalleryMatchEvaluation:
    if not face_embeddings:
        return GalleryMatchEvaluation(score=None, matched_person=None, had_faces=False)
    return evaluate_gallery_match(references, face_embeddings, threshold, couple_mode)


def evaluate_photo_for_match(
    references: list[np.ndarray],
    image_bgr: np.ndarray,
    threshold: float,
    couple_mode: bool,
) -> tuple[GalleryMatchEvaluation, list[np.ndarray], str]:
    """Detect faces, evaluate match, return embeddings + index status for persistence."""
    face_embeddings = detect_face_embeddings(image_bgr)
    if not face_embeddings:
        return (
            GalleryMatchEvaluation(score=None, matched_person=None, had_faces=False),
            [],
            "no_face",
        )
    evaluation = evaluate_gallery_match(references, face_embeddings, threshold, couple_mode)
    return evaluation, face_embeddings, "indexed"


def serialize_embeddings_for_db(embeddings: list[np.ndarray]) -> list[list[float]]:
    return embeddings_to_json(embeddings)
