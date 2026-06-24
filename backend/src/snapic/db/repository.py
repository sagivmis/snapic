from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
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


def _query_one(query: Any) -> dict[str, Any] | None:
    """Return one row from a Supabase select builder (.limit(1) avoids maybe_single None bugs)."""
    return _single_row(query.limit(1).execute())


def _parse_utc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _normalize_matched_person(value: Any) -> int | str | None:
    if value is None:
        return None
    if value == "both":
        return "both"
    if value in (1, "1"):
        return 1
    if value in (2, "2"):
        return 2
    return None


def _normalize_score(value: Any) -> float:
    return max(0.0, min(1.0, float(value)))


def _normalize_optional_score(value: Any) -> float | None:
    if value is None:
        return None
    return _normalize_score(value)


def fetch_event_by_slug(slug: str) -> dict[str, Any] | None:
    """Load event by slug via service role (bypasses RLS). Caller must enforce access rules."""
    client = get_supabase()
    return _query_one(client.table("events").select("*").eq("slug", slug))


def allocate_event_slug(base_slug: str) -> str:
    """Return base_slug if unused, otherwise append -2, -3, … until unique."""
    cleaned = (base_slug or "event").strip("-")[:80] or "event"
    if fetch_event_by_slug(cleaned) is None:
        return cleaned
    for suffix in range(2, 100):
        candidate = f"{cleaned}-{suffix}"[:80].strip("-")
        if fetch_event_by_slug(candidate) is None:
            return candidate
    raise RuntimeError("Could not allocate a unique event slug")


def fetch_event_by_id(event_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("events").select("*").eq("id", event_id))


_GALLERY_INDEXING_KEY = "gallery_indexing_started_at"
_GALLERY_INDEXING_STALE = timedelta(hours=3)


def set_event_gallery_indexing(event_id: str, active: bool) -> None:
    """Mark bulk face-index job in progress (stored in event branding JSON)."""
    row = fetch_event_by_id(event_id)
    if not row:
        return
    branding = dict(row.get("branding") or {})
    if active:
        branding[_GALLERY_INDEXING_KEY] = datetime.now(UTC).isoformat()
    else:
        branding.pop(_GALLERY_INDEXING_KEY, None)
    update_event(event_id, {"branding": branding})


def is_event_gallery_indexing(row: dict[str, Any]) -> bool:
    started = (row.get("branding") or {}).get(_GALLERY_INDEXING_KEY)
    started_at = _parse_utc_datetime(started if isinstance(started, str) else None)
    if started_at is None:
        return False
    return datetime.now(UTC) - started_at < _GALLERY_INDEXING_STALE


def gallery_search_ready(row: dict[str, Any], *, photo_count: int, pending: int) -> bool:
    return photo_count > 0 and pending == 0 and not is_event_gallery_indexing(row)


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


def gallery_thumbnail_path(event_id: str, photo_id: str) -> str:
    return f"{event_id}/thumbnails/{photo_id}.jpg"


def upload_gallery_thumbnail(event_id: str, photo_id: str, data: bytes) -> str:
    client = get_supabase()
    path = gallery_thumbnail_path(event_id, photo_id)
    client.storage.from_("events").upload(
        path,
        data,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    return path


def download_gallery_thumbnail_bytes(event_id: str, photo_id: str) -> bytes | None:
    try:
        return download_storage_bytes(gallery_thumbnail_path(event_id, photo_id))
    except Exception:
        return None


def create_gallery_signed_url(storage_path: str, expires_in: int = 3600) -> str | None:
    client = get_supabase()
    try:
        result = client.storage.from_("events").create_signed_url(storage_path, expires_in)
        if isinstance(result, dict):
            return result.get("signedURL") or result.get("signedUrl")
    except Exception:
        return None
    return None


def gallery_preview_storage_path(event_id: str, photo: dict[str, Any]) -> str:
    """Prefer cached thumbnails for grid previews when faces are indexed."""
    if photo.get("face_index_status") == "indexed":
        return gallery_thumbnail_path(event_id, photo["id"])
    return photo["storage_path"]


def batch_create_gallery_preview_urls(event_id: str, photos: list[dict[str, Any]]) -> dict[str, str]:
    from concurrent.futures import ThreadPoolExecutor

    if not photos:
        return {}

    def sign_one(photo: dict[str, Any]) -> tuple[str, str | None]:
        path = gallery_preview_storage_path(event_id, photo)
        return photo["id"], create_gallery_signed_url(path)

    workers = min(8, len(photos))
    urls: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for photo_id, signed_url in pool.map(sign_one, photos):
            if signed_url:
                urls[photo_id] = signed_url
    return urls


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


def fetch_gallery_photo_by_id(photo_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("gallery_photos").select("*").eq("id", photo_id))


def update_gallery_face_index(
    photo_id: str,
    face_embeddings: list[list[float]] | None,
    status: str,
) -> None:
    client = get_supabase()
    payload: dict[str, Any] = {"face_index_status": status}
    if face_embeddings is not None:
        payload["face_embeddings"] = face_embeddings
    try:
        client.table("gallery_photos").update(payload).eq("id", photo_id).execute()
    except Exception:
        client.table("gallery_photos").update({"face_index_status": status}).eq("id", photo_id).execute()


def index_gallery_photo_faces(photo_id: str, storage_path: str) -> str:
    import base64

    from snapic.face.images import decode_image_bytes, encode_thumbnail_base64
    from snapic.face.indexing import detect_face_embeddings, embeddings_to_json

    try:
        data = download_storage_bytes(storage_path)
        image_bgr = decode_image_bytes(data)
        embeddings = detect_face_embeddings(image_bgr)
        if not embeddings:
            update_gallery_face_index(photo_id, [], "no_face")
            return "no_face"
        update_gallery_face_index(photo_id, embeddings_to_json(embeddings), "indexed")
        event_id = storage_path.split("/")[0] if "/" in storage_path else None
        if event_id:
            thumb_bytes = base64.b64decode(encode_thumbnail_base64(image_bgr))
            upload_gallery_thumbnail(event_id, photo_id, thumb_bytes)
        return "indexed"
    except Exception:
        update_gallery_face_index(photo_id, None, "failed")
        return "failed"


def upload_gallery_photo(
    event_id: str,
    photo_id: str,
    data: bytes,
    mime: str,
    uploaded_by: str | None,
    filename: str | None,
    sort_order: int,
    content_hash: str | None = None,
    section: str = "general",
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
        "section": section,
        "face_index_status": "pending",
    }
    try:
        result = client.table("gallery_photos").insert(row).execute()
    except Exception:
        if content_hash:
            row.pop("content_hash", None)
        else:
            row.pop("face_index_status", None)
        try:
            result = client.table("gallery_photos").insert(row).execute()
        except Exception:
            row.pop("section", None)
            row.pop("face_index_status", None)
            result = client.table("gallery_photos").insert(row).execute()
    return (result.data or [row])[0]


def delete_gallery_photo(photo_id: str, storage_path: str) -> None:
    client = get_supabase()
    paths = [storage_path]
    if "/" in storage_path:
        event_id = storage_path.split("/")[0]
        paths.append(gallery_thumbnail_path(event_id, photo_id))
    client.storage.from_("events").remove(paths)
    client.table("gallery_photos").delete().eq("id", photo_id).execute()


def bulk_delete_gallery_photos(event_id: str, photo_ids: list[str]) -> tuple[int, int]:
    """Delete gallery photos belonging to event_id. Returns (deleted, not_found)."""
    unique_ids = list(dict.fromkeys(photo_ids))
    photos = list_gallery_photos(event_id)
    by_id = {photo["id"]: photo for photo in photos}

    deleted = 0
    not_found = 0
    for photo_id in unique_ids:
        target = by_id.get(photo_id)
        if not target:
            not_found += 1
            continue
        delete_gallery_photo(photo_id, target["storage_path"])
        deleted += 1
    return deleted, not_found


def is_event_admin(user_id: str, event_id: str) -> bool:
    client = get_supabase()
    profile = _query_one(client.table("profiles").select("global_role").eq("id", user_id))
    if profile and profile.get("global_role") == "super_admin":
        return True
    member = _query_one(
        client.table("event_members")
        .select("role")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
    )
    if member is not None:
        return True
    return is_org_event_access(user_id, event_id)


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
    row = _query_one(client.table("share_tokens").select("*").eq("token", token))
    if not row:
        return None
    expires = _parse_utc_datetime(row.get("expires_at"))
    if expires is None or expires < datetime.now(UTC):
        return None
    return row


def load_match_response_from_run(match_run_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    run = _query_one(client.table("match_runs").select("*").eq("id", match_run_id))
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
        image_mime = "image/jpeg"
        if row.get("preview_path"):
            try:
                import base64

                preview_bytes = download_storage_bytes(row["preview_path"])
                preview_b64 = base64.b64encode(preview_bytes).decode("ascii")
            except Exception:
                preview_b64 = ""

        filename = row.get("filename")
        if not filename and row.get("gallery_photo_id"):
            gallery = _query_one(
                client.table("gallery_photos")
                .select("filename,mime_type")
                .eq("id", row["gallery_photo_id"])
            )
            if gallery:
                filename = gallery.get("filename")
                image_mime = gallery.get("mime_type") or "image/jpeg"

        matched_photos.append(
            {
                "source": "upload",
                "index": idx,
                "score": _normalize_score(row["score"]),
                "filename": filename,
                "url": None,
                "preview_base64": preview_b64,
                "image_base64": None,
                "image_mime": image_mime,
                "gallery_photo_id": row.get("gallery_photo_id"),
                "matched_person": _normalize_matched_person(row.get("matched_person")),
                "person_1_score": _normalize_optional_score(row.get("person_1_score")),
                "person_2_score": _normalize_optional_score(row.get("person_2_score")),
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


def _list_storage_objects(prefix: str) -> list[str]:
    client = get_supabase()
    bucket = client.storage.from_("events")
    paths: list[str] = []

    def walk(folder: str) -> None:
        try:
            items = bucket.list(folder)
        except Exception:
            return
        for item in items or []:
            name = item.get("name")
            if not name:
                continue
            path = f"{folder}/{name}" if folder else name
            if item.get("id") is None and item.get("metadata") is None:
                walk(path)
            else:
                paths.append(path)

    walk(prefix)
    return paths


def delete_event(event_id: str) -> None:
    client = get_supabase()
    bucket = client.storage.from_("events")
    paths: list[str] = []
    for photo in list_gallery_photos(event_id):
        paths.append(photo["storage_path"])
        paths.append(gallery_thumbnail_path(event_id, photo["id"]))
    paths.extend(_list_storage_objects(event_id))
    unique = list(dict.fromkeys(path for path in paths if path))
    for index in range(0, len(unique), 100):
        try:
            bucket.remove(unique[index : index + 100])
        except Exception:
            pass
    client.table("events").delete().eq("id", event_id).execute()


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
    cleaned = email.strip().lower()
    if not cleaned:
        return None
    client = get_supabase()
    return _query_one(client.table("profiles").select("*").eq("email", cleaned))


def fetch_profile_by_id(user_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("profiles").select("email, full_name").eq("id", user_id))


def fetch_profile_role(user_id: str) -> str | None:
    client = get_supabase()
    row = _query_one(client.table("profiles").select("global_role").eq("id", user_id))
    if row:
        return row.get("global_role")
    return None


def list_event_admin_emails(event_id: str) -> list[str]:
    client = get_supabase()
    members = (
        client.table("event_members")
        .select("user_id")
        .eq("event_id", event_id)
        .execute()
        .data
        or []
    )
    emails: list[str] = []
    for member in members:
        user_id = member.get("user_id")
        if not user_id:
            continue
        profile = _query_one(client.table("profiles").select("email").eq("id", user_id))
        if not profile:
            continue
        email = profile.get("email")
        if isinstance(email, str) and email.strip():
            emails.append(email.strip().lower())
    return list(dict.fromkeys(emails))


def update_profile_role(user_id: str, global_role: str) -> bool:
    """Update profile global_role. Skips downgrading super_admin or photographer to event_admin."""
    if global_role == "event_admin":
        current = fetch_profile_role(user_id)
        if current in ("super_admin", "photographer"):
            return False
    client = get_supabase()
    client.table("profiles").update({"global_role": global_role}).eq("id", user_id).execute()
    return True


def count_pending_gallery_photos(event_id: str) -> int:
    """Photos still waiting for face indexing (blocks guest search)."""
    client = get_supabase()
    try:
        result = (
            client.table("gallery_photos")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .or_("face_index_status.eq.pending,face_index_status.is.null")
            .execute()
        )
        return result.count or 0
    except Exception:
        photos = list_gallery_photos(event_id)
        return sum(1 for p in photos if p.get("face_index_status") in ("pending", None))


def count_failed_gallery_photos(event_id: str) -> int:
    client = get_supabase()
    try:
        result = (
            client.table("gallery_photos")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .eq("face_index_status", "failed")
            .execute()
        )
        return result.count or 0
    except Exception:
        photos = list_gallery_photos(event_id)
        return sum(1 for p in photos if p.get("face_index_status") == "failed")


def count_unindexed_gallery_photos(event_id: str) -> int:
    """Pending or failed photos — used for admin attention (not guest search gating)."""
    client = get_supabase()
    try:
        result = (
            client.table("gallery_photos")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .in_("face_index_status", ["pending", "failed"])
            .execute()
        )
        return result.count or 0
    except Exception:
        photos = list_gallery_photos(event_id)
        return sum(1 for p in photos if p.get("face_index_status") in ("pending", "failed", None))


def event_archive_due(event_row: dict[str, Any]) -> bool:
    """True when an active event is past its auto-close window (no DB update)."""
    if event_row.get("status") != "active":
        return False
    wedding_date = event_row.get("wedding_date")
    if not wedding_date:
        return False
    close_days = int(event_row.get("auto_close_days") or 90)
    if isinstance(wedding_date, str):
        wedding = date.fromisoformat(wedding_date[:10])
    else:
        wedding = wedding_date
    return date.today() > wedding + timedelta(days=close_days)


def maybe_auto_close_event(event_row: dict[str, Any]) -> dict[str, Any]:
    if event_row.get("status") == "closed":
        return event_row
    wedding_date = event_row.get("wedding_date")
    if not wedding_date:
        return event_row
    close_days = int(event_row.get("auto_close_days") or 90)
    if isinstance(wedding_date, str):
        wedding = date.fromisoformat(wedding_date[:10])
    else:
        wedding = wedding_date
    if date.today() <= wedding + timedelta(days=close_days):
        return event_row
    client = get_supabase()
    result = client.table("events").update({"status": "closed"}).eq("id", event_row["id"]).execute()
    updated = (result.data or [event_row])[0]
    return updated if isinstance(updated, dict) else {**event_row, "status": "closed"}


def count_gallery_photos(event_id: str) -> int:
    return len(list_gallery_photos(event_id))


def update_gallery_photo_section(photo_id: str, section: str) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("gallery_photos").update({"section": section}).eq("id", photo_id).execute()
    return (result.data or [{}])[0]


def list_gallery_sections(event_id: str) -> list[str]:
    photos = list_gallery_photos(event_id)
    sections = sorted({p.get("section") or "general" for p in photos})
    return sections or ["general"]


def get_event_stats(event_id: str) -> dict[str, Any]:
    client = get_supabase()
    photos = list_gallery_photos(event_id)
    runs = client.table("match_runs").select("*").eq("event_id", event_id).execute().data or []
    sessions = {
        r.get("anonymous_session_id") or r.get("user_id")
        for r in runs
        if r.get("anonymous_session_id") or r.get("user_id")
    }
    last_match = None
    if runs:
        sorted_runs = sorted(runs, key=lambda r: r.get("created_at") or "", reverse=True)
        last_match = sorted_runs[0].get("created_at")
    return {
        "gallery_photo_count": len(photos),
        "match_run_count": len(runs),
        "unique_guest_sessions": len(sessions),
        "last_match_at": last_match,
    }


def list_user_match_runs(
    event_id: str,
    user_id: str | None,
    anonymous_session_id: str | None,
) -> list[dict[str, Any]]:
    client = get_supabase()
    query = client.table("match_runs").select("*").eq("event_id", event_id).order("created_at", desc=True)
    runs = query.execute().data or []
    filtered = [
        r
        for r in runs
        if (user_id and r.get("user_id") == user_id)
        or (anonymous_session_id and r.get("anonymous_session_id") == anonymous_session_id)
    ]
    summaries: list[dict[str, Any]] = []
    for run in filtered:
        share = client.table("share_tokens").select("token").eq("match_run_id", run["id"]).limit(1).execute()
        share_id = share.data[0]["token"] if share.data else None
        summaries.append(
            {
                "id": run["id"],
                "share_id": share_id,
                "matched_count": run.get("matched_count", 0),
                "total_gallery": int(run.get("total_gallery") or 0),
                "created_at": run.get("created_at"),
            }
        )
    return summaries


def is_super_admin(user_id: str) -> bool:
    return fetch_profile_role(user_id) == "super_admin"


def _event_needs_onboarding(event: dict[str, Any], is_admin: bool) -> bool:
    return (
        is_admin
        and event.get("status") == "draft"
        and not event.get("onboarding_completed_at")
    )


def list_user_events(user_id: str) -> list[dict[str, Any]]:
    """Events the user administers or has searched, excluding closed."""
    client = get_supabase()
    runs = client.table("match_runs").select("event_id, created_at").eq("user_id", user_id).execute().data or []
    members = client.table("event_members").select("event_id, role").eq("user_id", user_id).execute().data or []

    search_stats: dict[str, dict[str, Any]] = {}
    for run in runs:
        event_id = run["event_id"]
        stats = search_stats.setdefault(event_id, {"count": 0, "last_at": None})
        stats["count"] += 1
        created_at = run.get("created_at")
        if created_at and (stats["last_at"] is None or created_at > stats["last_at"]):
            stats["last_at"] = created_at

    admin_event_ids = {member["event_id"] for member in members}
    event_ids = set(search_stats) | admin_event_ids

    if is_super_admin(user_id):
        all_events = (
            client.table("events")
            .select("*")
            .neq("status", "closed")
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        summaries: list[dict[str, Any]] = []
        for event in all_events:
            event_id = event["id"]
            stats = search_stats.get(event_id, {"count": 0, "last_at": None})
            summaries.append(
                {
                    "id": event_id,
                    "slug": event["slug"],
                    "title": event["title"],
                    "status": event["status"],
                    "is_admin": True,
                    "last_search_at": stats["last_at"],
                    "search_count": stats["count"],
                    "needs_onboarding": _event_needs_onboarding(event, True),
                }
            )
        return summaries

    if not event_ids:
        return []

    events = client.table("events").select("*").in_("id", list(event_ids)).execute().data or []
    summaries = []
    for event in events:
        if event.get("status") == "closed":
            continue
        event_id = event["id"]
        stats = search_stats.get(event_id, {"count": 0, "last_at": None})
        summaries.append(
            {
                "id": event_id,
                "slug": event["slug"],
                "title": event["title"],
                "status": event["status"],
                "is_admin": event_id in admin_event_ids,
                "last_search_at": stats["last_at"],
                "search_count": stats["count"],
                "needs_onboarding": _event_needs_onboarding(event, event_id in admin_event_ids),
            }
        )

    summaries.sort(
        key=lambda row: row.get("last_search_at") or "",
        reverse=True,
    )
    return summaries


def fetch_organization(org_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("organizations").select("*").eq("id", org_id))


def fetch_organization_by_slug(slug: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("organizations").select("*").eq("slug", slug))


def list_user_organizations(user_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    members = client.table("org_members").select("org_id, role").eq("user_id", user_id).execute().data or []
    if not members:
        return []
    org_ids = [m["org_id"] for m in members]
    orgs = client.table("organizations").select("*").in_("id", org_ids).execute().data or []
    role_by_org = {m["org_id"]: m["role"] for m in members}
    return [{**org, "member_role": role_by_org.get(org["id"], "associate")} for org in orgs]


def get_primary_org_for_user(user_id: str) -> dict[str, Any] | None:
    orgs = list_user_organizations(user_id)
    if not orgs:
        return None
    owners = [o for o in orgs if o.get("member_role") == "owner"]
    return owners[0] if owners else orgs[0]


def get_org_for_user(user_id: str, org_id: str) -> dict[str, Any] | None:
    if not is_org_member(user_id, org_id):
        return None
    org = fetch_organization(org_id)
    if not org:
        return None
    client = get_supabase()
    row = _query_one(
        client.table("org_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
    )
    role = row.get("role") if row else "associate"
    return {**org, "member_role": role}


def is_org_member(user_id: str, org_id: str) -> bool:
    if is_super_admin(user_id):
        return True
    client = get_supabase()
    row = _query_one(
        client.table("org_members")
        .select("org_id")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
    )
    return row is not None


def is_org_owner(user_id: str, org_id: str) -> bool:
    if is_super_admin(user_id):
        return True
    client = get_supabase()
    row = _query_one(
        client.table("org_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
    )
    return row is not None and row.get("role") == "owner"


def is_org_event_access(user_id: str, event_id: str) -> bool:
    if is_super_admin(user_id):
        return True
    event = fetch_event_by_id(event_id)
    if not event or not event.get("organization_id"):
        return False
    org_id = event["organization_id"]
    client = get_supabase()
    member = _query_one(
        client.table("org_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", user_id)
    )
    if not member:
        return False
    if member.get("role") == "owner":
        return True
    org = fetch_organization(org_id)
    settings = (org or {}).get("settings") or {}
    if settings.get("associate_scope", "org") == "org":
        return True
    assigned = _query_one(
        client.table("org_event_assignments")
        .select("event_id")
        .eq("event_id", event_id)
        .eq("user_id", user_id)
    )
    return assigned is not None


def list_org_events(org_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    return (
        client.table("events")
        .select("*")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def list_organizations() -> list[dict[str, Any]]:
    client = get_supabase()
    return client.table("organizations").select("*").order("created_at", desc=True).execute().data or []


def create_organization(data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    result = client.table("organizations").insert(data).execute()
    return (result.data or [data])[0]


def update_organization(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    data = {**data, "updated_at": datetime.now(UTC).isoformat()}
    result = client.table("organizations").update(data).eq("id", org_id).execute()
    return (result.data or [{}])[0]


def add_org_member(org_id: str, user_id: str, role: str = "associate") -> None:
    client = get_supabase()
    client.table("org_members").upsert(
        {"org_id": org_id, "user_id": user_id, "role": role}
    ).execute()


def list_org_members(org_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    members = client.table("org_members").select("*").eq("org_id", org_id).execute().data or []
    enriched: list[dict[str, Any]] = []
    for member in members:
        profile = _query_one(
            client.table("profiles").select("email, full_name").eq("id", member["user_id"])
        )
        enriched.append(
            {
                **member,
                "email": profile.get("email") if profile else None,
                "full_name": profile.get("full_name") if profile else None,
            }
        )
    return enriched


def allocate_org_slug(base_slug: str) -> str:
    cleaned = (base_slug or "studio").strip("-")[:80] or "studio"
    if fetch_organization_by_slug(cleaned) is None:
        return cleaned
    for suffix in range(2, 100):
        candidate = f"{cleaned}-{suffix}"[:80].strip("-")
        if fetch_organization_by_slug(candidate) is None:
            return candidate
    raise RuntimeError("Could not allocate a unique organization slug")


def increment_org_events_used(org_id: str) -> None:
    org = fetch_organization(org_id)
    if not org:
        return
    used = int(org.get("events_used_this_period") or 0) + 1
    update_organization(org_id, {"events_used_this_period": used})


def org_can_create_event(org_id: str) -> tuple[bool, str | None]:
    org = fetch_organization(org_id)
    if not org:
        return False, "Organization not found"
    plan = org.get("plan") or "pay_per_event"
    if plan in ("pay_per_event", "unlimited"):
        return True, None
    included = int(org.get("events_included_per_period") or 0)
    used = int(org.get("events_used_this_period") or 0)
    if used >= included:
        return False, "Event quota exhausted for this billing period"
    return True, None


def count_org_events(org_id: str) -> int:
    client = get_supabase()
    result = client.table("events").select("id", count="exact").eq("organization_id", org_id).execute()
    return result.count or 0


def has_pending_org_invite(org_id: str, email: str) -> bool:
    cleaned = email.strip().lower()
    if not cleaned:
        return False
    client = get_supabase()
    row = _query_one(
        client.table("org_invites")
        .select("id")
        .eq("org_id", org_id)
        .eq("status", "pending")
        .ilike("email", cleaned)
    )
    return row is not None


def create_org_invite(
    org_id: str,
    email: str,
    role: str,
    invited_by: str | None,
    user_id: str | None = None,
) -> dict[str, Any]:
    cleaned = email.strip().lower()
    client = get_supabase()
    payload = {
        "org_id": org_id,
        "email": cleaned,
        "role": role,
        "status": "pending",
        "invited_by": invited_by,
        "user_id": user_id,
    }
    result = client.table("org_invites").insert(payload).execute()
    return (result.data or [payload])[0]


def list_pending_org_invites_for_user(user_id: str, email: str) -> list[dict[str, Any]]:
    cleaned = email.strip().lower()
    client = get_supabase()
    by_user = (
        client.table("org_invites")
        .select("*")
        .eq("status", "pending")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    by_email = (
        client.table("org_invites")
        .select("*")
        .eq("status", "pending")
        .ilike("email", cleaned)
        .execute()
        .data
        or []
    )
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for row in by_user + by_email:
        invite_id = row.get("id")
        if not invite_id or invite_id in seen:
            continue
        seen.add(invite_id)
        rows.append(row)
    enriched: list[dict[str, Any]] = []
    for row in rows:
        org = fetch_organization(row["org_id"])
        if not org:
            continue
        inviter = None
        if row.get("invited_by"):
            inviter = _query_one(
                client.table("profiles").select("email, full_name").eq("id", row["invited_by"])
            )
        enriched.append(
            {
                **row,
                "org_name": org.get("name"),
                "org_slug": org.get("slug"),
                "invited_by_email": inviter.get("email") if inviter else None,
            }
        )
    return enriched


def list_pending_org_invites_for_org(org_id: str) -> list[dict[str, Any]]:
    client = get_supabase()
    return (
        client.table("org_invites")
        .select("*")
        .eq("org_id", org_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def fetch_org_invite(invite_id: str) -> dict[str, Any] | None:
    client = get_supabase()
    return _query_one(client.table("org_invites").select("*").eq("id", invite_id))


def accept_org_invite(invite_id: str, user_id: str, email: str) -> dict[str, Any]:
    invite = fetch_org_invite(invite_id)
    if not invite or invite.get("status") != "pending":
        raise ValueError("Invite not found or already handled")
    cleaned = email.strip().lower()
    invite_email = (invite.get("email") or "").strip().lower()
    invite_user = invite.get("user_id")
    if invite_user and invite_user != user_id:
        raise ValueError("Invite is for another user")
    if not invite_user and invite_email != cleaned:
        raise ValueError("Invite is for another email")
    if is_org_member(user_id, invite["org_id"]):
        client = get_supabase()
        client.table("org_invites").update(
            {"status": "accepted", "responded_at": datetime.now(UTC).isoformat(), "user_id": user_id}
        ).eq("id", invite_id).execute()
        return invite
    add_org_member(invite["org_id"], user_id, invite.get("role") or "associate")
    current_role = fetch_profile_role(user_id)
    if current_role in (None, "guest", "event_admin"):
        update_profile_role(user_id, "photographer")
    client = get_supabase()
    client.table("org_invites").update(
        {"status": "accepted", "responded_at": datetime.now(UTC).isoformat(), "user_id": user_id}
    ).eq("id", invite_id).execute()
    return invite


def decline_org_invite(invite_id: str, user_id: str, email: str) -> dict[str, Any]:
    invite = fetch_org_invite(invite_id)
    if not invite or invite.get("status") != "pending":
        raise ValueError("Invite not found or already handled")
    cleaned = email.strip().lower()
    invite_email = (invite.get("email") or "").strip().lower()
    invite_user = invite.get("user_id")
    if invite_user and invite_user != user_id:
        raise ValueError("Invite is for another user")
    if not invite_user and invite_email != cleaned:
        raise ValueError("Invite is for another email")
    client = get_supabase()
    client.table("org_invites").update(
        {"status": "declined", "responded_at": datetime.now(UTC).isoformat(), "user_id": user_id}
    ).eq("id", invite_id).execute()
    return invite
