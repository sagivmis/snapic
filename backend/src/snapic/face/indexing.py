from __future__ import annotations

from typing import Any

import numpy as np

from snapic.face.detector import get_face_engine

FaceIndexStatus = str  # pending | indexed | no_face | failed


def detect_face_embeddings(image_bgr: np.ndarray) -> list[np.ndarray]:
    engine = get_face_engine()
    return [face.embedding for face in engine.detect_faces(image_bgr)]


def embeddings_to_json(embeddings: list[np.ndarray]) -> list[list[float]]:
    return [embedding.astype(float).tolist() for embedding in embeddings]


def embeddings_from_json(raw: Any) -> list[np.ndarray]:
    if not raw:
        return []
    if not isinstance(raw, list):
        return []
    return [np.asarray(item, dtype=np.float32) for item in raw]
