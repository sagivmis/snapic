import io

import numpy as np
from PIL import Image

from snapic.face.images import (
    decode_image_bytes,
    detect_image_mime,
    encode_image_base64,
    encode_original_base64,
    encode_thumbnail_base64,
)


def _solid_image(color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (64, 64), color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_decode_image_bytes_returns_bgr_array():
    data = _solid_image((255, 0, 0))
    decoded = decode_image_bytes(data)
    assert decoded.shape == (64, 64, 3)
    assert decoded.dtype == np.uint8


def test_encode_original_base64_preserves_bytes():
    data = _solid_image((10, 20, 30))
    encoded = encode_original_base64(data)
    import base64

    assert base64.b64decode(encoded) == data


def test_detect_image_mime_jpeg():
    data = _solid_image((0, 0, 0))
    assert detect_image_mime(data) == "image/jpeg"


def test_encode_thumbnail_smaller_than_full():
    data = _solid_image((100, 100, 100))
    import base64

    image_bgr = decode_image_bytes(data)
    thumb = base64.b64decode(encode_thumbnail_base64(image_bgr))
    full = base64.b64decode(encode_image_base64(image_bgr))
    # Thumbnail should be smaller for a decently sized image - 64x64 might be same
    # Use larger image
    large = Image.new("RGB", (2000, 1500), (100, 100, 100))
    buf = io.BytesIO()
    large.save(buf, format="JPEG", quality=95)
    large_bgr = decode_image_bytes(buf.getvalue())
    thumb_large = len(base64.b64decode(encode_thumbnail_base64(large_bgr)))
    full_large = len(base64.b64decode(encode_image_base64(large_bgr)))
    assert thumb_large < full_large
