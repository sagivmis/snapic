from __future__ import annotations

from snapic.db.supabase_client import get_supabase


def app_base_url() -> str:
    import os

    explicit = os.getenv("SNAPIC_APP_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    if origins:
        return origins.split(",")[0].strip().rstrip("/")
    return "http://localhost:5173"


def send_event_admin_invite(email: str, event_slug: str, event_id: str, role: str = "admin") -> None:
    client = get_supabase()
    redirect_to = f"{app_base_url()}/login?next=/e/{event_slug}/manage"
    metadata = {
        "pending_event_id": event_id,
        "pending_event_role": role,
    }
    try:
        client.auth.admin.invite_user_by_email(
            email,
            options={"redirect_to": redirect_to, "data": metadata},
        )
        return
    except Exception:
        pass

    client.auth.admin.generate_link(
        {
            "type": "magiclink",
            "email": email,
            "options": {"redirect_to": redirect_to, "data": metadata},
        }
    )
