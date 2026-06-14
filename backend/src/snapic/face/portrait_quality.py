from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from snapic.face.detector import get_face_engine


@dataclass(frozen=True)
class PortraitQualityResult:
    face_detected: bool
    warnings: list[str]
    face_count: int = 0


def analyze_portrait(image_bgr: np.ndarray) -> PortraitQualityResult:
    engine = get_face_engine()
    faces = engine.detect_faces(image_bgr)
    if not faces:
        return PortraitQualityResult(
            face_detected=False,
            warnings=["No face detected — use a clear front-facing photo"],
        )

    warnings: list[str] = []
    if len(faces) > 1:
        warnings.append("Multiple faces detected — use a solo portrait for best results")

    face = max(faces, key=lambda item: item.area)
    height, width = image_bgr.shape[:2]
    image_area = max(width * height, 1)
    face_ratio = face.area / image_area

    if face_ratio < 0.02:
        warnings.append("Face is too small — try a closer selfie")
    elif face_ratio < 0.04:
        warnings.append("Face is a bit small — move closer if you can")

    x1, y1, x2, y2 = face.bbox
    pad = 8
    crop = image_bgr[
        max(y1 - pad, 0) : min(y2 + pad, height),
        max(x1 - pad, 0) : min(x2 + pad, width),
    ]
    if crop.size > 0:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if sharpness < 80:
            warnings.append("Photo looks blurry — hold steady and use good light")

        brightness = float(gray.mean())
        if brightness < 55:
            warnings.append("Photo is quite dark — try brighter lighting")
        elif brightness > 210:
            warnings.append("Photo is very bright — avoid harsh direct light")

    return PortraitQualityResult(
        face_detected=True,
        warnings=warnings,
        face_count=len(faces),
    )
