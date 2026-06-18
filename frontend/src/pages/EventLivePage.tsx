import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { buildEventGuestUrl, fetchEventBySlug } from "../api/client";
import { GuestQrCode } from "../components/GuestQrCode";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import type { EventPublic } from "../types";
import "../styles/EventLive.scss";

export function EventLivePage() {
  const { slug = "" } = useParams();
  const { session, getAccessToken, isSuperAdmin } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const guestUrl = useMemo(() => (slug ? buildEventGuestUrl(slug) : ""), [slug]);
  const branding = event?.branding ?? {};
  const coupleNames =
    typeof branding.couple_names === "string" && branding.couple_names.trim()
      ? branding.couple_names.trim()
      : event?.title ?? "Your gallery";
  const accent =
    typeof branding.accent_color === "string" ? branding.accent_color : "#c9a962";

  const load = useCallback(async () => {
    if (!slug || !session) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const ev = await fetchEventBySlug(slug, token);
      setEvent(ev);

      let hasMembership = isSuperAdmin;
      if (supabase && !hasMembership) {
        const { data: membership } = await supabase
          .from("event_members")
          .select("role")
          .eq("event_id", ev.id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        hasMembership = Boolean(membership);
      }
      setIsAdmin(hasMembership);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event");
    } finally {
      setLoading(false);
    }
  }, [slug, session, getAccessToken, isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyGuestLink() {
    if (!guestUrl) {
      return;
    }
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="event-live event-live--loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!event || !isAdmin) {
    return (
      <div className="event-live">
        <div className="event-live__card">
          <h1>Launch summary</h1>
          <p>{error ?? "This event could not be loaded."}</p>
          <Link to="/" className="btn btn-secondary">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="event-live" style={{ "--event-accent": accent } as CSSProperties}>
      <div className="event-live__shell">
        <header className="event-live__header">
          <p className="event-live__eyebrow">Snapic</p>
          <h1>You&apos;re live!</h1>
          <p className="event-live__lead">
            {coupleNames} is ready for guests. Share the link or QR code at the venue.
          </p>
        </header>

        <div className="event-live__card">
          <h2>Guest link</h2>
          <div className="event-live__link-row">
            <code>{guestUrl}</code>
            <button type="button" className="btn btn-secondary" onClick={() => void copyGuestLink()}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <GuestQrCode
            url={guestUrl}
            eventTitle={event.title}
            coupleNames={typeof branding.couple_names === "string" ? branding.couple_names : undefined}
          />

          <ul className="event-live__tips">
            <li>Print the QR card for tables or the entrance</li>
            <li>Guests upload a selfie and get every photo they appear in</li>
            <li>You can upload more photos anytime from your dashboard</li>
          </ul>

          <div className="event-live__actions">
            <Link className="btn btn-primary" to={`/e/${slug}`} target="_blank" rel="noreferrer">
              Preview guest page
            </Link>
            <Link className="btn btn-secondary" to={`/e/${slug}/manage`}>
              Open dashboard
            </Link>
          </div>
        </div>

        {event.status !== "active" && (
          <p className="event-live__note">
            Your event is still in <strong>{event.status}</strong> status. Set it to Active in
            Settings so guests can search.
          </p>
        )}
      </div>
    </div>
  );
}
