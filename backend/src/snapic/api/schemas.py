from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MatchedPhoto(BaseModel):
    source: Literal["upload", "url"]
    index: int
    score: float = Field(ge=0.0, le=1.0)
    filename: str | None = None
    url: str | None = None
    preview_base64: str
    image_base64: str
    image_mime: str = "image/jpeg"
    matched_person: Literal[1, 2, "both"] | None = None
    person_1_score: float | None = Field(default=None, ge=0.0, le=1.0)
    person_2_score: float | None = Field(default=None, ge=0.0, le=1.0)


class SkippedPhoto(BaseModel):
    source: Literal["upload", "url"]
    index: int
    reason: Literal["no_face_detected", "decode_failed", "fetch_failed", "not_an_image"]
    filename: str | None = None
    url: str | None = None


class MatchResponse(BaseModel):
    reference_face_detected: bool
    threshold: float
    total_gallery: int
    matched: list[MatchedPhoto]
    skipped: list[SkippedPhoto]
    share_id: str | None = None
    couple_mode: bool = False


class SharedMatchResponse(MatchResponse):
    share_id: str


class HealthResponse(BaseModel):
    status: str


class PortraitQualityResponse(BaseModel):
    face_detected: bool
    warnings: list[str]
    face_count: int = 0
