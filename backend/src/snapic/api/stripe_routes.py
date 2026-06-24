from __future__ import annotations

import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from snapic.api.schemas import StripeCheckoutRequest, StripeCheckoutResponse
from snapic.auth.jwt import AuthUser, get_required_user
from snapic.auth.org import require_org_owner
from snapic.db.repository import update_event, update_organization

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_PRICES: dict[str, dict[str, Any]] = {
    "pay_per_event": {"amount": 9900, "mode": "payment", "events": 1, "photos_cap": 1500, "tier": "standard"},
    "bundle_10": {"amount": 64900, "mode": "payment", "events": 10, "photos_cap": 1500, "tier": "pro"},
    "bundle_25": {"amount": 129900, "mode": "payment", "events": 25, "photos_cap": 3000, "tier": "pro"},
    "unlimited": {"amount": 79900, "mode": "subscription", "events": 9999, "photos_cap": 5000, "tier": "white_label"},
}


def _stripe():
    import stripe

    key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="Billing not configured")
    stripe.api_key = key
    return stripe


@router.post("/checkout", response_model=StripeCheckoutResponse)
async def create_checkout(
    body: StripeCheckoutRequest,
    user: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_owner)],
) -> StripeCheckoutResponse:
    stripe = _stripe()
    plan_meta = PLAN_PRICES.get(body.plan)
    if not plan_meta:
        raise HTTPException(status_code=400, detail="Unknown plan")

    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "unit_amount": plan_meta["amount"],
                "product_data": {"name": f"Snapic {body.plan.replace('_', ' ')}"},
            },
            "quantity": 1,
        }
    ]
    metadata = {
        "plan": body.plan,
        "paid_by": body.paid_by,
        "organization_id": org["id"],
        "user_id": user.id,
    }
    if body.event_id:
        metadata["event_id"] = body.event_id

    session = stripe.checkout.Session.create(
        mode=plan_meta["mode"],
        line_items=line_items,
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        customer=org.get("stripe_customer_id"),
        metadata=metadata,
    )
    if not session.url or not session.id:
        raise HTTPException(status_code=502, detail="Could not create checkout session")
    return StripeCheckoutResponse(checkout_url=session.url, session_id=session.id)


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict[str, str]:
    stripe = _stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        org_id = metadata.get("organization_id")
        plan = metadata.get("plan", "pay_per_event")
        plan_meta = PLAN_PRICES.get(plan, PLAN_PRICES["pay_per_event"])
        if org_id:
            patch: dict[str, Any] = {
                "plan": plan,
                "branding_tier": plan_meta["tier"],
                "photos_cap_per_event": plan_meta["photos_cap"],
                "events_included_per_period": int(plan_meta["events"]),
            }
            customer = session.get("customer")
            if customer:
                patch["stripe_customer_id"] = customer
            if plan == "pay_per_event":
                from snapic.db.repository import fetch_organization, increment_org_events_used

                org_row = fetch_organization(org_id)
                if org_row:
                    used = int(org_row.get("events_used_this_period") or 0) + 1
                    patch["events_used_this_period"] = used
            update_organization(org_id, patch)
        event_id = metadata.get("event_id")
        if event_id:
            update_event(event_id, {"billing_status": "paid", "paid_by": metadata.get("paid_by")})

    return {"status": "ok"}


@router.get("/portal")
async def billing_portal(
    return_url: str,
    _: Annotated[AuthUser, Depends(get_required_user)],
    org: Annotated[dict[str, Any], Depends(require_org_owner)],
) -> dict[str, str]:
    stripe = _stripe()
    customer = org.get("stripe_customer_id")
    if not customer:
        raise HTTPException(status_code=400, detail="No billing account yet")
    session = stripe.billing_portal.Session.create(customer=customer, return_url=return_url)
    return {"url": session.url}
