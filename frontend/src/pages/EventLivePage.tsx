import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { buildEventGuestUrl, fetchEventBySlug } from "../api/client";
import { GuestQrCode } from "../components/GuestQrCode";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import { supabase } from "../lib/supabase";
import type { EventPublic } from "../types";
import "../styles/EventLive.scss";

export function EventLivePage() {
  const { t, tPath } = useTranslation("events.live");
  const { tPath: tCommon } = useTranslation("events.common");
  const { tPath: tStatus } = useTranslation("events.common.status");
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
      : event?.title ?? tCommon("defaultGalleryTitle");
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
        throw new Error(t("notSignedIn"));
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
      setError(err instanceof Error ? err.message : tPath("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [slug, session, getAccessToken, isSuperAdmin, t, tPath]);

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
          <h1>{tPath("title")}</h1>
          <p>{error ?? tPath("loadFailed")}</p>
          <Link to="/" className="btn btn-secondary">
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel =
    event.status === "draft"
      ? tStatus("draft")
      : event.status === "active"
        ? tStatus("active")
        : tStatus("closed");

  return (
    <div className="event-live" style={{ "--event-accent": accent } as CSSProperties}>
      <div className="event-live__shell">
        <header className="event-live__header">
          <p className="event-live__eyebrow">{tPath("eyebrow")}</p>
          <h1>{tPath("headline")}</h1>
          <p className="event-live__lead">{tPath("lead", { coupleNames })}</p>
        </header>

        <div className="event-live__card">
          <h2>{tPath("guestLinkTitle")}</h2>
          <div className="event-live__link-row">
            <code>{guestUrl}</code>
            <button type="button" className="btn btn-secondary" onClick={() => void copyGuestLink()}>
              {copied ? tPath("copied") : tPath("copyLink")}
            </button>
          </div>

          <GuestQrCode
            url={guestUrl}
            eventTitle={event.title}
            coupleNames={typeof branding.couple_names === "string" ? branding.couple_names : undefined}
          />

          <ul className="event-live__tips">
            <li>{tPath("tips.printQr")}</li>
            <li>{tPath("tips.selfieSearch")}</li>
            <li>{tPath("tips.uploadMore")}</li>
          </ul>

          <div className="event-live__actions">
            <Link className="btn btn-primary" to={`/e/${slug}`} target="_blank" rel="noreferrer">
              {tPath("previewGuestPage")}
            </Link>
            <Link className="btn btn-secondary" to={`/e/${slug}/manage`}>
              {tPath("openDashboard")}
            </Link>
          </div>
        </div>

        {event.status !== "active" && (
          <p className="event-live__note">
            {tPath("statusNote", { status: statusLabel })}
          </p>
        )}
      </div>
    </div>
  );
}
