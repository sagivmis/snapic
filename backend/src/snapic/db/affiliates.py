from __future__ import annotations

import os
import re
from datetime import UTC, datetime
from typing import Any

from snapic.db import get_supabase

_AFFILIATE_PAYOUT_NIS = int(os.getenv("SNAPIC_AFFILIATE_PAYOUT_NIS", "100"))
_AFFILIATE_PAYOUT_THRESHOLD = int(os.getenv("SNAPIC_AFFILIATE_PAYOUT_THRESHOLD", "5"))
_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$")


def normalize_affiliate_code(code: str) -> str:
    return code.strip().lower()


def is_valid_affiliate_code(code: str) -> bool:
    normalized = normalize_affiliate_code(code)
    return bool(_CODE_RE.match(normalized))


def get_active_affiliate_by_code(code: str) -> dict[str, Any] | None:
    normalized = normalize_affiliate_code(code)
    if not normalized:
        return None
    client = get_supabase()
    result = (
        client.table("affiliates")
        .select("*")
        .eq("code", normalized)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def list_affiliates() -> list[dict[str, Any]]:
    client = get_supabase()
    return (
        client.table("affiliates")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def create_affiliate(data: dict[str, Any]) -> dict[str, Any]:
    client = get_supabase()
    payload = {
        **data,
        "code": normalize_affiliate_code(data["code"]),
        "payout_details": data.get("payout_details") or {},
    }
    result = client.table("affiliates").insert(payload).execute()
    return (result.data or [payload])[0]


def count_approved_referrals(affiliate_code: str) -> int:
    client = get_supabase()
    normalized = normalize_affiliate_code(affiliate_code)
    result = (
        client.table("signup_requests")
        .select("id", count="exact")
        .eq("referral_code", normalized)
        .eq("status", "approved")
        .execute()
    )
    return result.count or 0


def list_affiliate_payouts(status: str | None = None) -> list[dict[str, Any]]:
    client = get_supabase()
    query = (
        client.table("affiliate_payouts")
        .select("*, affiliates(code, display_name, email), signup_requests(email, couple_names)")
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    return (query.execute().data) or []


def maybe_accrue_affiliate_payout(signup_request: dict[str, Any]) -> dict[str, Any] | None:
    referral_code = signup_request.get("referral_code")
    if not referral_code or signup_request.get("status") != "approved":
        return None

    affiliate = get_active_affiliate_by_code(referral_code)
    if not affiliate:
        return None

    if affiliate.get("email", "").lower() == signup_request.get("email", "").lower():
        return None

    approved_count = count_approved_referrals(referral_code)
    if approved_count <= _AFFILIATE_PAYOUT_THRESHOLD:
        return None

    client = get_supabase()
    existing = (
        client.table("affiliate_payouts")
        .select("id")
        .eq("signup_request_id", signup_request["id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        return existing[0]

    payload = {
        "affiliate_id": affiliate["id"],
        "signup_request_id": signup_request["id"],
        "amount_nis": _AFFILIATE_PAYOUT_NIS,
        "status": "accrued",
    }
    result = client.table("affiliate_payouts").insert(payload).execute()
    return (result.data or [payload])[0]


def mark_affiliate_payouts_paid(payout_ids: list[str]) -> int:
    if not payout_ids:
        return 0
    client = get_supabase()
    now = datetime.now(UTC).isoformat()
    result = (
        client.table("affiliate_payouts")
        .update({"status": "paid", "paid_at": now})
        .in_("id", payout_ids)
        .eq("status", "accrued")
        .execute()
    )
    return len(result.data or [])


def affiliate_stats(code: str) -> dict[str, int]:
    normalized = normalize_affiliate_code(code)
    client = get_supabase()
    submissions = (
        client.table("signup_requests")
        .select("id", count="exact")
        .eq("referral_code", normalized)
        .execute()
        .count
        or 0
    )
    approved = count_approved_referrals(normalized)
    affiliate = get_active_affiliate_by_code(normalized)
    accrued = 0
    paid = 0
    if affiliate:
        payouts = (
            client.table("affiliate_payouts")
            .select("status, amount_nis")
            .eq("affiliate_id", affiliate["id"])
            .execute()
            .data
            or []
        )
        for row in payouts:
            if row.get("status") == "accrued":
                accrued += int(row.get("amount_nis") or 0)
            elif row.get("status") == "paid":
                paid += int(row.get("amount_nis") or 0)
    return {
        "submissions": submissions,
        "approved": approved,
        "accrued_nis": accrued,
        "paid_nis": paid,
    }
