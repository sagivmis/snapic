import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from snapic.api.routes import router

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def get_allowed_origins() -> list[str]:
    extra = os.getenv("ALLOWED_ORIGINS", "")
    origins = list(DEFAULT_ORIGINS)
    for origin in extra.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in origins:
            origins.append(cleaned)
    return origins


def get_allowed_origin_regex() -> str | None:
    explicit = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip()
    if explicit:
        return explicit
    if os.getenv("SNAPIC_ALLOW_VERCEL", "true").lower() in {"1", "true", "yes"}:
        return r"https://.*\.vercel\.app"
    return None


app = FastAPI(title="Snapic", version="0.1.0")

_cors_regex = get_allowed_origin_regex()
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
