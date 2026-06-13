import os

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from snapic.api.routes import router
from snapic.face.detector import get_face_engine

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


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_face_engine()
    yield


app = FastAPI(title="Snapic", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
