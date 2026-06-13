from __future__ import annotations

import os
import threading
from functools import lru_cache

import numpy as np

from snapic.face.matcher import DetectedFace

DEFAULT_FACE_MODEL = "buffalo_l"
DEFAULT_DET_SIZE = 640


def get_face_model_name() -> str:
    return os.getenv("SNAPIC_FACE_MODEL", DEFAULT_FACE_MODEL).strip() or DEFAULT_FACE_MODEL


def get_det_size() -> int:
    raw = os.getenv("SNAPIC_DET_SIZE", str(DEFAULT_DET_SIZE)).strip()
    try:
        size = int(raw)
    except ValueError:
        return DEFAULT_DET_SIZE
    return max(128, min(size, 1024))


class FaceEngine:
    """Singleton wrapper around InsightFace for detection and embeddings."""

    _instance: FaceEngine | None = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        import insightface

        model_name = get_face_model_name()
        det_size = get_det_size()
        self._app = insightface.app.FaceAnalysis(
            name=model_name,
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(det_size, det_size))
        self.model_name = model_name
        self.det_size = det_size

    @classmethod
    def get(cls) -> FaceEngine:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._instance = None

    def detect_faces(self, image_bgr: np.ndarray) -> list[DetectedFace]:
        faces = self._app.get(image_bgr)
        detected: list[DetectedFace] = []
        for face in faces:
            bbox = face.bbox.astype(int)
            x1, y1, x2, y2 = bbox.tolist()
            width = max(x2 - x1, 0)
            height = max(y2 - y1, 0)
            detected.append(
                DetectedFace(
                    bbox=(x1, y1, x2, y2),
                    embedding=np.asarray(face.embedding, dtype=np.float32),
                    area=width * height,
                )
            )
        return detected

    def get_reference_face(self, image_bgr: np.ndarray) -> DetectedFace | None:
        faces = self.detect_faces(image_bgr)
        if not faces:
            return None
        return max(faces, key=lambda face: face.area)


@lru_cache(maxsize=1)
def get_face_engine() -> FaceEngine:
    return FaceEngine.get()


def reset_face_engine() -> None:
    get_face_engine.cache_clear()
    FaceEngine.reset()
