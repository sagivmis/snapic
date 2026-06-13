import base64
from io import BytesIO

import cv2
import numpy as np
from PIL import Image


def decode_image_bytes(data: bytes) -> np.ndarray:
    """Decode image bytes to BGR numpy array for OpenCV/InsightFace."""
    image = Image.open(BytesIO(data))
    image = image.convert("RGB")
    rgb = np.array(image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def detect_image_mime(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    return "image/jpeg"


def encode_original_base64(data: bytes) -> str:
    """Return base64 of the original image bytes (no recompression)."""
    return base64.b64encode(data).decode("ascii")


def encode_image_base64(image_bgr: np.ndarray, max_size: int = 2400, quality: int = 92) -> str:
    """Encode full-resolution image for download/lightbox, resizing only if very large."""
    height, width = image_bgr.shape[:2]
    scale = min(max_size / width, max_size / height, 1.0)
    if scale < 1.0:
        new_width = int(width * scale)
        new_height = int(height * scale)
        image_bgr = cv2.resize(image_bgr, (new_width, new_height), interpolation=cv2.INTER_AREA)

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb)
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def encode_thumbnail_base64(image_bgr: np.ndarray, max_size: int = 400) -> str:
    """Resize image and return base64-encoded JPEG for grid previews."""
    height, width = image_bgr.shape[:2]
    scale = min(max_size / width, max_size / height, 1.0)
    if scale < 1.0:
        new_width = int(width * scale)
        new_height = int(height * scale)
        image_bgr = cv2.resize(image_bgr, (new_width, new_height), interpolation=cv2.INTER_AREA)

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb)
    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode("ascii")
