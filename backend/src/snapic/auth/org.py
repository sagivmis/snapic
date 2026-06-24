from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, HTTPException

from snapic.auth.jwt import AuthUser, get_required_user
from snapic.db.repository import fetch_organization, get_primary_org_for_user, is_org_member, is_org_owner


async def require_org_member(
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> dict[str, Any]:
    org = get_primary_org_for_user(user.id)
    if not org:
        raise HTTPException(status_code=403, detail="Studio membership required")
    return org


async def require_org_owner(
    user: Annotated[AuthUser, Depends(get_required_user)],
) -> dict[str, Any]:
    org = await require_org_member(user)
    if not is_org_owner(user.id, org["id"]):
        raise HTTPException(status_code=403, detail="Studio owner access required")
    return org


def require_org_event(user_id: str, event_id: str, org_id: str | None) -> None:
    if not org_id:
        raise HTTPException(status_code=403, detail="Not a studio event")
    if not is_org_member(user_id, org_id):
        raise HTTPException(status_code=403, detail="Access denied")
