from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Literal

import jwt
from fastapi import Depends, HTTPException, Header
from jwt import PyJWKClient, PyJWTError

GlobalRole = Literal["super_admin", "event_admin", "guest"]

_ASYMMETRIC_ALGORITHMS = ("RS256", "ES256", "ES384", "EdDSA")


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    global_role: GlobalRole


def _jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Auth not configured")
    return secret


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient | None:
    base_url = _supabase_url()
    if not base_url:
        return None
    return PyJWKClient(f"{base_url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def _payload_to_user(payload: dict[str, Any]) -> AuthUser:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    app_meta = payload.get("app_metadata") or {}
    role = app_meta.get("role") or payload.get("role") or "guest"
    if role not in ("super_admin", "event_admin", "guest"):
        role = "guest"

    return AuthUser(
        id=str(sub),
        email=payload.get("email"),
        global_role=role,  # type: ignore[arg-type]
    )


def _decode_symmetric(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        _jwt_secret(),
        algorithms=["HS256"],
        audience="authenticated",
    )


def _decode_asymmetric(token: str) -> dict[str, Any]:
    client = _jwks_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Auth not configured")
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=list(_ASYMMETRIC_ALGORITHMS),
        audience="authenticated",
    )


def decode_token(token: str) -> AuthUser:
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    algorithm = header.get("alg", "HS256")

    try:
        if algorithm == "HS256":
            payload = _decode_symmetric(token)
        elif algorithm in _ASYMMETRIC_ALGORITHMS:
            payload = _decode_asymmetric(token)
        else:
            raise HTTPException(status_code=401, detail="Unsupported token algorithm")
    except HTTPException:
        raise
    except PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    return _payload_to_user(payload)


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    return decode_token(token)


async def get_required_user(
    user: Annotated[AuthUser | None, Depends(get_optional_user)],
) -> AuthUser:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_super_admin(
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> AuthUser:
    from snapic.db import is_supabase_configured
    from snapic.db.repository import fetch_profile_role

    role = user.global_role
    if is_supabase_configured():
        db_role = fetch_profile_role(user.id)
        if db_role:
            role = db_role  # type: ignore[assignment]

    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


def get_anonymous_session_id(
    x_anonymous_session_id: Annotated[str | None, Header()] = None,
) -> str | None:
    if not x_anonymous_session_id:
        return None
    cleaned = x_anonymous_session_id.strip()
    return cleaned if len(cleaned) >= 8 else None
