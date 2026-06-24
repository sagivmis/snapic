from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException

from snapic.auth.jwt import AuthUser, get_required_user
from snapic.db.repository import (
    fetch_organization,
    get_org_for_user,
    get_primary_org_for_user,
    is_org_member,
    is_org_owner,
    list_user_organizations,
)


async def resolve_studio_org_id(
    x_studio_org_id: Annotated[str | None, Header(alias="X-Studio-Org-Id")] = None,
) -> str | None:
    if x_studio_org_id and x_studio_org_id.strip():
        return x_studio_org_id.strip()
    return None


async def require_org_member(
    user: Annotated[AuthUser, Depends(get_required_user)],
    org_id: Annotated[str | None, Depends(resolve_studio_org_id)] = None,
) -> dict[str, Any]:
    orgs = list_user_organizations(user.id)
    if not orgs:
        raise HTTPException(status_code=403, detail="Studio membership required")
    if org_id:
        org = get_org_for_user(user.id, org_id)
        if not org:
            raise HTTPException(status_code=403, detail="Not a member of this studio")
        return org
    primary = get_primary_org_for_user(user.id)
    if not primary:
        raise HTTPException(status_code=403, detail="Studio membership required")
    return primary


async def require_org_owner(
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_member)],
) -> dict[str, Any]:
    if not is_org_owner(user.id, org["id"]):
        raise HTTPException(status_code=403, detail="Studio owner access required")
    return org


def require_org_event(user_id: str, event_id: str, org_id: str | None) -> None:
    if not org_id:
        raise HTTPException(status_code=403, detail="Not a studio event")
    if not is_org_member(user_id, org_id):
        raise HTTPException(status_code=403, detail="Access denied")
