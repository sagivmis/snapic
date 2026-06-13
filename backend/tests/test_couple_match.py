import numpy as np
import pytest

from snapic.face.pipeline import evaluate_gallery_match


def _vec(*values: float) -> np.ndarray:
    return np.asarray(values, dtype=np.float32)


def test_single_mode_match():
    refs = [_vec(1.0, 0.0)]
    faces = [_vec(0.95, 0.31)]
    result = evaluate_gallery_match(refs, faces, threshold=0.4, couple_mode=False)
    assert result.score is not None
    assert result.matched_person is None


def test_couple_mode_person_one_only():
    refs = [_vec(1.0, 0.0), _vec(0.0, 1.0)]
    faces = [_vec(0.99, 0.01)]
    result = evaluate_gallery_match(refs, faces, threshold=0.4, couple_mode=True)
    assert result.matched_person == 1


def test_couple_mode_person_two_only():
    refs = [_vec(1.0, 0.0), _vec(0.0, 1.0)]
    faces = [_vec(0.01, 0.99)]
    result = evaluate_gallery_match(refs, faces, threshold=0.4, couple_mode=True)
    assert result.matched_person == 2


def test_couple_mode_both_people():
    refs = [_vec(1.0, 0.0), _vec(0.0, 1.0)]
    faces = [_vec(0.99, 0.01), _vec(0.01, 0.99)]
    result = evaluate_gallery_match(refs, faces, threshold=0.4, couple_mode=True)
    assert result.matched_person == "both"
    assert result.score is not None


def test_couple_mode_no_match():
    refs = [_vec(1.0, 0.0), _vec(0.0, 1.0)]
    faces = [_vec(0.3, 0.3)]
    result = evaluate_gallery_match(refs, faces, threshold=0.85, couple_mode=True)
    assert result.score is None
    assert result.matched_person is None


def test_no_faces():
    refs = [_vec(1.0, 0.0)]
    result = evaluate_gallery_match(refs, [], threshold=0.4, couple_mode=False)
    assert result.had_faces is False
