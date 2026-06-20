from __future__ import annotations

import logging
import os

import httpx

from snapic.db.auth_admin import app_base_url

logger = logging.getLogger(__name__)


def _from_address() -> str:
    return os.getenv("SNAPIC_FROM_EMAIL", "Snapic <onboarding@resend.dev>").strip()


def _send_html_email(to: list[str], subject: str, html: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    cleaned = [email.strip().lower() for email in to if email and email.strip()]
    if not api_key:
        logger.warning("RESEND_API_KEY not set; skipping email %s", subject)
        return False
    if not cleaned:
        logger.info("No recipients for email %s", subject)
        return False

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": _from_address(),
                "to": cleaned,
                "subject": subject,
                "html": html,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return True
    except Exception:
        logger.exception("Failed to send email to %s", cleaned)
        return False


def _email_shell(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #4a4036; max-width: 32rem;">
      <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #9a7649;">
        Snapic
      </p>
      <h1 style="font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem;">{title}</h1>
      {body_html}
    </div>
    """


def send_gallery_approval_email(to_email: str, couple_names: str, event_slug: str) -> bool:
    """Send a welcome email when a signup request is approved."""
    setup_path = f"/login?next=/e/{event_slug}/setup"
    setup_url = f"{app_base_url()}{setup_path}"
    guest_url = f"{app_base_url()}/e/{event_slug}"
    body = f"""
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
    """
    return _send_html_email(
        [to_email],
        f"Your Snapic gallery for {couple_names} is ready",
        _email_shell("Your wedding gallery is ready", body),
    )


def send_signup_rejection_email(to_email: str, couple_names: str) -> bool:
    """Notify a couple when their signup request is not approved."""
    body = f"""
      <p>Hi {couple_names},</p>
      <p>
        Thank you for your interest in Snapic. After reviewing your request, we're unable to offer
        a gallery at this time.
      </p>
      <p style="font-size: 0.875rem; color: #6b5e52;">
        If you believe this was a mistake or would like to discuss your wedding date and needs,
        reply to this email and our team will take another look.
      </p>
    """
    return _send_html_email(
        [to_email],
        f"Update on your Snapic gallery request — {couple_names}",
        _email_shell("Gallery request update", body),
    )


def send_album_ready_email(to_emails: list[str], couple_names: str, event_slug: str) -> bool:
    """Notify admins that photos are indexed and the gallery can go live."""
    setup_url = f"{app_base_url()}/e/{event_slug}/setup"
    body = f"""
      <p>Hi {couple_names},</p>
      <p>
        Your wedding photos are uploaded and faces have been indexed. You're one step away —
        set your event to <strong>Active</strong> when you're ready for guests to search.
      </p>
      <p>
        <a href="{setup_url}" style="display: inline-block; padding: 0.75rem 1.25rem; border-radius: 999px;
          background: #9a7649; color: #ffffff; text-decoration: none; font-weight: 600;">
          Continue setup
        </a>
      </p>
    """
    return _send_html_email(
        to_emails,
        f"Your Snapic album is ready to go live — {couple_names}",
        _email_shell("Your album is ready", body),
    )


def send_gallery_live_email(to_emails: list[str], couple_names: str, event_slug: str) -> bool:
    """Notify admins that the guest gallery is now live."""
    guest_url = f"{app_base_url()}/e/{event_slug}"
    manage_url = f"{app_base_url()}/e/{event_slug}/live"
    body = f"""
      <p>Hi {couple_names},</p>
      <p>
        Your Snapic gallery is now <strong>live</strong>. Share this link with wedding guests so they
        can upload a selfie and find every photo they're in:
      </p>
      <p>
        <a href="{guest_url}" style="display: inline-block; padding: 0.75rem 1.25rem; border-radius: 999px;
          background: #9a7649; color: #ffffff; text-decoration: none; font-weight: 600;">
          {guest_url}
        </a>
      </p>
      <p style="font-size: 0.875rem; color: #6b5e52;">
        <a href="{manage_url}">Open your launch summary</a> for the guest link, QR code, and share tips.
      </p>
    """
    return _send_html_email(
        to_emails,
        f"Your Snapic gallery is live — {couple_names}",
        _email_shell("You're live!", body),
    )
