from __future__ import annotations

import os
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from threading import Lock

from fastapi import HTTPException, Request

_MATCH_LIMIT = int(os.getenv("SNAPIC_MATCH_RATE_LIMIT_PER_HOUR", "20"))
_MATCH_WINDOW_SECONDS = 3600


class _SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window = timedelta(seconds=window_seconds)
        self._hits: dict[str, list[datetime]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = datetime.now(UTC)
        with self._lock:
            hits = [timestamp for timestamp in self._hits[key] if timestamp > now - self.window]
            if len(hits) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many photo searches. Please wait about an hour before trying again.",
                )
            hits.append(now)
            self._hits[key] = hits


_SIGNUP_LIMIT = int(os.getenv("SNAPIC_SIGNUP_RATE_LIMIT_PER_HOUR", "5"))
_SIGNUP_WINDOW_SECONDS = 3600

_match_limiter = _SlidingWindowLimiter(_MATCH_LIMIT, _MATCH_WINDOW_SECONDS)
_signup_limiter = _SlidingWindowLimiter(_SIGNUP_LIMIT, _SIGNUP_WINDOW_SECONDS)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def enforce_match_rate_limit(
    request: Request,
    event_id: str,
    anonymous_session_id: str | None,
) -> None:
    if _MATCH_LIMIT <= 0:
        return
    ip = _client_ip(request)
    key = f"{event_id}:session:{anonymous_session_id}" if anonymous_session_id else f"{event_id}:ip:{ip}"
    _match_limiter.check(key)


def enforce_signup_rate_limit(request: Request) -> None:
    if _SIGNUP_LIMIT <= 0:
        return
    ip = _client_ip(request)
    _signup_limiter.check(f"signup:ip:{ip}")
