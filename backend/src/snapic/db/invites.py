from __future__ import annotations

from snapic.db.auth_admin import send_event_admin_invite
from snapic.db.repository import (
    add_event_member,
    find_profile_by_email,
    update_profile_role,
)


def invite_event_admin(email: str, event_id: str, event_slug: str, role: str = "admin") -> None:
    cleaned = email.strip().lower()
    profile = find_profile_by_email(cleaned)
    if profile:
        add_event_member(event_id, profile["id"], role)
        update_profile_role(profile["id"], "event_admin")
    send_event_admin_invite(cleaned, event_slug, event_id, role)
