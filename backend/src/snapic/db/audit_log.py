from __future__ import annotations

from typing import Any

from snapic.db.supabase_client import get_supabase


def record_audit_log(
    *,
    actor_id: str | None,
    actor_email: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    event_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    client = get_supabase()
    payload: dict[str, Any] = {
        "actor_id": actor_id,
        "actor_email": actor_email,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "event_id": event_id,
        "metadata": metadata or {},
    }
    try:
        client.table("audit_log").insert(payload).execute()
    except Exception:
        pass


def list_audit_log(limit: int = 50) -> list[dict[str, Any]]:
    client = get_supabase()
    capped = max(1, min(limit, 200))
    result = (
        client.table("audit_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(capped)
        .execute()
    )
    return result.data or []
