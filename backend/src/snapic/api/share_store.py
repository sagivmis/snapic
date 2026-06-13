from __future__ import annotations

import time
import uuid

from snapic.api.schemas import MatchResponse

TTL_SECONDS = 7 * 24 * 60 * 60


class ShareStore:
    def __init__(self) -> None:
        self._entries: dict[str, tuple[MatchResponse, float]] = {}

    def save(self, result: MatchResponse) -> str:
        self._cleanup()
        share_id = str(uuid.uuid4())
        self._entries[share_id] = (result, time.time())
        return share_id

    def get(self, share_id: str) -> MatchResponse | None:
        self._cleanup()
        entry = self._entries.get(share_id)
        if entry is None:
            return None
        return entry[0]

    def _cleanup(self) -> None:
        now = time.time()
        expired = [
            share_id
            for share_id, (_, created_at) in self._entries.items()
            if now - created_at > TTL_SECONDS
        ]
        for share_id in expired:
            del self._entries[share_id]


share_store = ShareStore()
