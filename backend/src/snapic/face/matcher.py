from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class DetectedFace:
    bbox: tuple[int, int, int, int]
    embedding: np.ndarray
    area: int


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity for L2-normalized embeddings."""
    a_flat = a.flatten().astype(np.float64)
    b_flat = b.flatten().astype(np.float64)
    norm_a = np.linalg.norm(a_flat)
    norm_b = np.linalg.norm(b_flat)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_flat, b_flat) / (norm_a * norm_b))


def is_match(score: float, threshold: float) -> bool:
    return score >= threshold
