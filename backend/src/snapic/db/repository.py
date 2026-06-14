from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from snapic.db import get_supabase


def _single_row(result: Any) -> dict[str, Any] | None:
    if result is None:
        return None
    data = getattr(result, "data", None)
    if data is None:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    if isinstance(data, dict):
        return data
    return None


def fetch_event_by_slug(slug: str) -> dict[str, Any] | None:
    """Load event by slug via service role (bypasses RLS). Caller must enforce access rules."""
    client = get_supabase()
    result = client.table("events").select("*").eq("slug", slug).maybe_single().execute()
    return _single_row(result)


def fetch_event_by_id(event_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    result = client.table("events").select("*").eq("id", event_id).maybe_single().execute()
    return _single_row(result)


def list_gallery_photos(event_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    result = (
        client.table("gallery_photos")
        .select("*")
        .eq("event_id", event_id)
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    return result.data or []


def download_storage_bytes(storage_path: str) -> bytes:
    client = get_supabase()
    return client.storage.from_("events").download(storage_path)


def upload_preview_bytes(event_id: str, result_id: str, data: bytes, mime: str = "image/jpeg") -> str:
    client = get_supabase()
    ext = "jpg" if "jpeg" in mime else "png"
    path = f"{event_id}/previews/{result_id}.{ext}"
    client.storage.from_("events").upload(
        path,
        data,
        file_options={"content-type": mime, "upsert": "true"},
    )
    return path


def find_gallery_photo_by_hash(event_id: str, content_hash: str) -> dict[str, Any] | None:
    client = get_supabase()
    try:
        result = (
            client.table("gallery_photos")
            .select("*")
            .eq("event_id", event_id)
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
        )
        return _single_row(result)
    except Exception:
        # content_hash column missing before migration 003, or transient API error
        return None


def upload_gallery_photo(
    event_id: str,
    photo_id: str,
    data: bytes,
    mime: str,
    uploaded_by: str | None,
    filename: str | None,
    sort_order: int,
    content_hash: str | None = None,
) -> dict[str, Any]:
    client = get_supabase()
    ext = "jpg"
    if "png" in mime:
        ext = "png"
    elif "webp" in mime:
        ext = "webp"
    path = f"{event_id}/gallery/{photo_id}.{ext}"
    client.storage.from_("events").upload(
        path,
        data,
        file_options={"content-type": mime, "upsert": "false"},
    )
    row = {
        "id": photo_id,
        "event_id": event_id,
        "storage_path": path,
        "filename": filename,
        "mime_type": mime,
        "sort_order": sort_order,
        "uploaded_by": uploaded_by,
        "content_hash": content_hash,
    }
    try:
        result = client.table("gallery_photos").insert(row).execute()
    except Exception:
        if not content_hash:
            raise
        row.pop("content_hash", None)
        result = client.table("gallery_photos").insert(row).execute()
    return (result.data or [row])[0]


def delete_gallery_photo(photo_id: str, storage_path: str) -> None:
    client = get_supabase()
    client.storage.from_("events").remove([storage_path])
    client.table("gallery_photos").delete().eq("id", photo_id).execute()


def is_event_admin(user_id: str, event_id: str) -> bool:
    client = get_supabase()
    profile = _single_row(
        client.table("profiles").select("global_role").eq("id", user_id).maybe_single().execute()
    )
    if profile and profile.get("global_role") == "super_admin":
        return True
    member = _single_row(
        client.table("event_members")
        .select("role")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return member is not None


def create_match_run(
    *,
    event_id: str,
    user_id: str | None,
    anonymous_session_id: str | None,
    couple_mode: bool,
    threshold: float,
    total_gallery: int,
    matched_count: int,
    skipped_count: int,
) -> str:
    client = get_supabase()
    run_id = str(uuid.uuid4())
    client.table("match_runs").insert(
        {
            "id": run_id,
            "event_id": event_id,
            "user_id": user_id,
            "anonymous_session_id": anonymous_session_id,
            "couple_mode": couple_mode,
            "threshold": threshold,
            "total_gallery": total_gallery,
            "matched_count": matched_count,
            "skipped_count": skipped_count,
        }
    ).execute()
    return run_id


def save_match_results(
    match_run_id: str,
    matched: list[dict[str, Any]],
    skipped: list[dict[str, Any]],
) -> None:
    client = get_supabase()
    if matched:
        client.table("match_results").insert(matched).execute()
    if skipped:
        client.table("skipped_photos").insert(skipped).execute()


def create_share_token(match_run_id: str, ttl_days: int = 7) -> str:
    client = get_supabase()
    token = str(uuid.uuid4())
    expires = datetime.now(UTC) + timedelta(days=ttl_days)
    client.table("share_tokens").insert(
        {
            "token": token,
            "match_run_id": match_run_id,
            "expires_at": expires.isoformat(),
        }
    ).execute()
    return token


def get_share_token(token: str) -> dict[str, Any] | None:
    client = get_supabase()
    row = _single_row(client.table("share_tokens").select("*").eq("token", token).maybe_single().execute())
    if not row:
        return None
    expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    if expires < datetime.now(UTC):
        return None
    return row


def load_match_response_from_run(match_run_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    run = _single_row(client.table("match_runs").select("*").eq("id", match_run_id).maybe_single().execute())
    if not run:
        return None

    results = (
        client.table("match_results")
        .select("*")
        .eq("match_run_id", match_run_id)
        .order("sort_index")
        .execute()
    )
    skipped = (
        client.table("skipped_photos")
        .select("*")
        .eq("match_run_id", match_run_id)
        .order("sort_index")
        .execute()
    )

    matched_photos = []
    for idx, row in enumerate(results.data or []):
        preview_b64 = ""
        image_b64 = ""
        image_mime = "image/jpeg"
        if row.get("preview_path"):
            try:
                import base64

                preview_bytes = download_storage_bytes(row["preview_path"])
                preview_b64 = base64.b64encode(preview_bytes).decode("ascii")
            except Exception:
                preview_b64 = ""
        if row.get("gallery_photo_id"):
            gallery = _single_row(
                client.table("gallery_photos")
                .select("storage_path,mime_type,filename")
                .eq("id", row["gallery_photo_id"])
                .maybe_single()
                .execute()
            )
            if gallery:
                try:
                    import base64

                    full_bytes = download_storage_bytes(gallery["storage_path"])
                    image_b64 = base64.b64encode(full_bytes).decode("ascii")
                    image_mime = gallery.get("mime_type") or "image/jpeg"
                    if not row.get("filename"):
                        row["filename"] = gallery.get("filename")
                except Exception:
                    pass

        matched_photos.append(
            {
                "source": "upload",
                "index": idx,
                "score": row["score"],
                "filename": row.get("filename"),
                "url": None,
                "preview_base64": preview_b64,
                "image_base64": image_b64 or preview_b64,
                "image_mime": image_mime,
                "matched_person": row.get("matched_person"),
                "person_1_score": row.get("person_1_score"),
                "person_2_score": row.get("person_2_score"),
            }
        )

    skipped_photos = [
        {
            "source": "upload",
            "index": idx,
            "reason": row["reason"],
            "filename": row.get("filename"),
            "url": None,
        }
        for idx, row in enumerate(skipped.data or [])
    ]

    share = client.table("share_tokens").select("token").eq("match_run_id", match_run_id).limit(1).execute()
    share_id = share.data[0]["token"] if share.data else None

    return {
        "reference_face_detected": True,
        "threshold": run["threshold"],
        "total_gallery": run["total_gallery"],
        "matched": matched_photos,
        "skipped": skipped_photos,
        "share_id": share_id,
        "couple_mode": run.get("couple_mode", False),
        "event_id": run["event_id"],
    }


def list_events() -> list[dict[str, Any]]:
    client = get_supabase()
    result = client.table("events").select("*").order("created_at", desc=True).execute()
    return result.data or []


def create_event(data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("events").insert(data).execute()
    return (result.data or [data])[0]


def update_event(event_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("events").update(data).eq("id", event_id).execute()
    return (result.data or [{}])[0]


def list_signup_requests(status: str | None = None) -> list[dict[str, Any]]:
    client = get_supabase()
    query = client.table("signup_requests").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    return (query.execute().data) or []


def create_signup_request(data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("signup_requests").insert(data).execute()
    return (result.data or [data])[0]


def update_signup_request(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("signup_requests").update(data).eq("id", request_id).execute()
    return (result.data or [{}])[0]


def add_event_member(event_id: str, user_id: str, role: str = "admin") -> None:
    client = get_supabase()
    client.table("event_members").upsert(
        {"event_id": event_id, "user_id": user_id, "role": role}
    ).execute()


def find_profile_by_email(email: str) -> dict[str, Any] | None:
    client = get_supabase()
    result = client.table("profiles").select("*").eq("email", email).maybe_single().execute()
    return _single_row(result)


def fetch_profile_role(user_id: str) -> str | None:
    client = get_supabase()
    row = _single_row(
        client.table("profiles").select("global_role").eq("id", user_id).maybe_single().execute()
    )
    if row:
        return row.get("global_role")
    return None


def update_profile_role(user_id: str, global_role: str) -> None:
    client = get_supabase()
    client.table("profiles").update({"global_role": global_role}).eq("id", user_id).execute()
