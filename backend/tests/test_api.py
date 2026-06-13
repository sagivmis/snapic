import io
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from snapic.face.detector import reset_face_engine
from snapic.face.matcher import DetectedFace
from snapic.main import app

FACE_ENGINE_PATCHES = (
    "snapic.face.detector.get_face_engine",
    "snapic.face.pipeline.get_face_engine",
)


def _image_bytes(color: tuple[int, int, int] = (120, 80, 200)) -> bytes:
    image = Image.new("RGB", (128, 128), color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _mock_face(embedding: list[float], area: int = 1000) -> DetectedFace:
    return DetectedFace(
        bbox=(0, 0, 100, 100),
        embedding=np.asarray(embedding, dtype=np.float32),
        area=area,
    )


@pytest.fixture(autouse=True)
def clear_face_engine_cache():
    reset_face_engine()
    yield
    reset_face_engine()


def _mock_engine_for_match() -> MagicMock:
    reference = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    match_embedding = np.array([0.95, 0.31, 0.0], dtype=np.float32)
    no_match_embedding = np.array([0.0, 1.0, 0.0], dtype=np.float32)

    engine = MagicMock()
    engine.get_reference_face.return_value = _mock_face(reference.tolist())
    engine.detect_faces.side_effect = [
        [_mock_face(match_embedding.tolist())],
        [_mock_face(no_match_embedding.tolist())],
    ]
    return engine


@patch(FACE_ENGINE_PATCHES[1])
@patch(FACE_ENGINE_PATCHES[0])
def test_match_endpoint_returns_matches(mock_detector, mock_pipeline):
    engine = _mock_engine_for_match()
    mock_detector.return_value = engine
    mock_pipeline.return_value = engine

    with TestClient(app) as client:
        response = client.post(
            "/api/match",
            data={"threshold": "0.4"},
            files=[
                ("selfie", ("selfie.jpg", _image_bytes(), "image/jpeg")),
                ("gallery_files", ("match.jpg", _image_bytes((10, 200, 10)), "image/jpeg")),
                ("gallery_files", ("nomatch.jpg", _image_bytes((200, 10, 10)), "image/jpeg")),
            ],
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["reference_face_detected"] is True
    assert payload["total_gallery"] == 2
    assert len(payload["matched"]) == 1
    assert payload["matched"][0]["filename"] == "match.jpg"


@patch(FACE_ENGINE_PATCHES[1])
@patch(FACE_ENGINE_PATCHES[0])
def test_match_endpoint_requires_gallery(mock_detector, mock_pipeline):
    engine = MagicMock()
    mock_detector.return_value = engine
    mock_pipeline.return_value = engine

    with TestClient(app) as client:
        response = client.post(
            "/api/match",
            files=[("selfie", ("selfie.jpg", _image_bytes(), "image/jpeg"))],
        )

    assert response.status_code == 400
    assert "at least one gallery" in response.json()["detail"].lower()


@patch(FACE_ENGINE_PATCHES[1])
@patch(FACE_ENGINE_PATCHES[0])
def test_match_endpoint_no_face_in_selfie(mock_detector, mock_pipeline):
    engine = MagicMock()
    engine.get_reference_face.return_value = None
    mock_detector.return_value = engine
    mock_pipeline.return_value = engine

    with TestClient(app) as client:
        response = client.post(
            "/api/match",
            data={"gallery_urls": '["https://example.com/photo.jpg"]'},
            files=[("selfie", ("selfie.jpg", _image_bytes(), "image/jpeg"))],
        )

    assert response.status_code == 400
    assert "no face detected" in response.json()["detail"].lower()
