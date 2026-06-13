from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal

import numpy as np

from snapic.face.detector import get_face_engine


class NoFaceInSelfieError(Exception):
    pass


class SkipReason(str, Enum):
    NO_FACE_DETECTED = "no_face_detected"
    DECODE_FAILED = "decode_failed"


MatchedPerson = Literal[1, 2, "both"]


@dataclass
class GalleryMatch:
    source: str
    index: int
    score: float
    filename: str | None = None
    url: str | None = None


@dataclass
class SkippedImage:
    source: str
    index: int
    reason: SkipReason
    filename: str | None = None
    url: str | None = None


@dataclass(frozen=True)
class GalleryMatchEvaluation:
    score: float | None
    matched_person: MatchedPerson | None
    had_faces: bool = True


def extract_reference_embedding(image_bgr: np.ndarray) -> np.ndarray:
    engine = get_face_engine()
    reference = engine.get_reference_face(image_bgr)
    if reference is None:
        raise NoFaceInSelfieError("No face detected in selfie")
    return reference.embedding


def _best_score_per_reference(
    reference_embeddings: list[np.ndarray],
    face_embeddings: list[np.ndarray],
) -> list[float]:
    from snapic.face.matcher import cosine_similarity

    scores: list[float] = []
    for reference in reference_embeddings:
        if not face_embeddings:
            scores.append(0.0)
            continue
        scores.append(max(cosine_similarity(reference, face) for face in face_embeddings))
    return scores


def evaluate_gallery_match(
    reference_embeddings: list[np.ndarray],
    face_embeddings: list[np.ndarray],
    threshold: float,
    couple_mode: bool,
) -> GalleryMatchEvaluation:
    """Pure matching logic — testable without InsightFace."""
    if not face_embeddings:
        return GalleryMatchEvaluation(score=None, matched_person=None, had_faces=False)

    person_scores = _best_score_per_reference(reference_embeddings, face_embeddings)

    if not couple_mode or len(reference_embeddings) == 1:
        best_score = max(person_scores)
        if best_score >= threshold:
            return GalleryMatchEvaluation(score=best_score, matched_person=None)
        return GalleryMatchEvaluation(score=None, matched_person=None)

    person_one_score = person_scores[0]
    person_two_score = person_scores[1] if len(person_scores) > 1 else 0.0
    person_one_match = person_one_score >= threshold
    person_two_match = person_two_score >= threshold

    if person_one_match and person_two_match:
        return GalleryMatchEvaluation(
            score=max(person_one_score, person_two_score),
            matched_person="both",
        )
    if person_one_match:
        return GalleryMatchEvaluation(score=person_one_score, matched_person=1)
    if person_two_match:
        return GalleryMatchEvaluation(score=person_two_score, matched_person=2)
    return GalleryMatchEvaluation(score=None, matched_person=None)


def evaluate_gallery_image(
    reference_embeddings: list[np.ndarray],
    image_bgr: np.ndarray,
    threshold: float,
    couple_mode: bool,
) -> GalleryMatchEvaluation:
    engine = get_face_engine()
    faces = engine.detect_faces(image_bgr)
    face_embeddings = [face.embedding for face in faces]
    return evaluate_gallery_match(reference_embeddings, face_embeddings, threshold, couple_mode)


def best_face_score(reference_embedding: np.ndarray, image_bgr: np.ndarray) -> float | None:
    """Return best similarity score across all faces, or None if no face detected."""
    result = evaluate_gallery_image([reference_embedding], image_bgr, threshold=0.0, couple_mode=False)
    return result.score


def best_face_score_with_person(
    reference_embeddings: list[np.ndarray],
    image_bgr: np.ndarray,
    threshold: float = 0.0,
    couple_mode: bool = False,
) -> tuple[float | None, MatchedPerson | None]:
    result = evaluate_gallery_image(
        reference_embeddings,
        image_bgr,
        threshold=threshold,
        couple_mode=couple_mode,
    )
    return result.score, result.matched_person
