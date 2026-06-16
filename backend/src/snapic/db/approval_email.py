from __future__ import annotations

import logging
import os

import httpx

from snapic.db.auth_admin import app_base_url

logger = logging.getLogger(__name__)


def _from_address() -> str:
    return os.getenv("SNAPIC_FROM_EMAIL", "Snapic <onboarding@resend.dev>").strip()


def send_gallery_approval_email(to_email: str, couple_names: str, event_slug: str) -> None:
    """Send a welcome email when a signup request is approved. No-op if Resend is not configured."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.info("RESEND_API_KEY not set; skipping approval email to %s", to_email)
        return

    setup_path = f"/login?next=/e/{event_slug}/setup"
    setup_url = f"{app_base_url()}{setup_path}"
    guest_url = f"{app_base_url()}/e/{event_slug}"
    subject = f"Your Snapic gallery for {couple_names} is ready"
    html = f"""
    <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #4a4036; max-width: 32rem;">
      <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #9a7649;">
        Snapic
      </p>
      <h1 style="font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem;">Your wedding gallery is ready</h1>
      <p>Hi {couple_names},</p>
      <p>
        Great news — your private Snapic gallery has been approved. You can personalize your guest
        page, upload photos, and share a link with wedding guests so they can find themselves in every shot.
      </p>
      <p>
        <a href="{setup_url}" style="display: inline-block; padding: 0.75rem 1.25rem; border-radius: 999px;
          background: #9a7649; color: #ffffff; text-decoration: none; font-weight: 600;">
          Set up your gallery
        </a>
      </p>
      <p style="font-size: 0.875rem; color: #6b5e52;">
        After setup, guests will use this link at the venue:<br />
        <a href="{guest_url}">{guest_url}</a>
      </p>
      <p style="font-size: 0.8125rem; color: #8a7b6c;">
        If the button does not work, copy and paste this URL into your browser:<br />
        {setup_url}
      </p>
    </div>
    """

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": _from_address(),
                "to": [to_email.strip().lower()],
                "subject": subject,
                "html": html,
            },
            timeout=15.0,
        )
        response.raise_for_status()
    except Exception:
        logger.exception("Failed to send approval email to %s", to_email)
