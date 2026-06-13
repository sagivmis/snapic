import numpy as np
import pytest

from snapic.face.matcher import cosine_similarity, is_match


def test_cosine_similarity_identical_vectors():
    vector = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert cosine_similarity(vector, vector) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors():
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([0.0, 1.0], dtype=np.float32)
    assert cosine_similarity(a, b) == pytest.approx(0.0)


def test_cosine_similarity_opposite_vectors():
    a = np.array([1.0, 0.0], dtype=np.float32)
    b = np.array([-1.0, 0.0], dtype=np.float32)
    assert cosine_similarity(a, b) == pytest.approx(-1.0)


def test_is_match_at_threshold():
    assert is_match(0.4, 0.4) is True
    assert is_match(0.39, 0.4) is False
    assert is_match(0.55, 0.4) is True


def test_cosine_similarity_zero_vector():
    zero = np.zeros(3, dtype=np.float32)
    unit = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert cosine_similarity(zero, unit) == 0.0
