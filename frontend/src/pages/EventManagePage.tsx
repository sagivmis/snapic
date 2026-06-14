import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  buildEventGuestUrl,
  deleteEventGalleryPhoto,
  fetchEventBySlug,
  fetchEventGallery,
  inviteEventMember,
  updateEvent,
  uploadEventGalleryPhoto,
} from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import type { EventPublic, GalleryPhoto } from "../types";
import "../styles/EventManage.scss";

export function EventManagePage() {
  const { slug = "" } = useParams();
  const { getAccessToken, session } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [status, setStatus] = useState<EventPublic["status"]>("draft");
  const [coupleNames, setCoupleNames] = useState("");
  const [accentColor, setAccentColor] = useState("#c9a962");
  const [threshold, setThreshold] = useState(0.4);
  const [inviteEmail, setInviteEmail] = useState("");

  const guestUrl = useMemo(() => (slug ? buildEventGuestUrl(slug) : ""), [slug]);

  const load = useCallback(async () => {
    if (!slug || !session) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ev = await fetchEventBySlug(slug);
      setEvent(ev);
      setTitle(ev.title);
      setWeddingDate(ev.wedding_date ?? "");
      setStatus(ev.status);
      setThreshold(ev.default_threshold);
      const branding = ev.branding ?? {};
      setCoupleNames(typeof branding.couple_names === "string" ? branding.couple_names : "");
      setAccentColor(typeof branding.accent_color === "string" ? branding.accent_color : "#c9a962");

      if (supabase) {
        const { data: membership } = await supabase
          .from("event_members")
          .select("role")
          .eq("event_id", ev.id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsAdmin(Boolean(membership));
      }

      const token = await getAccessToken();
      const gallery = await fetchEventGallery(ev.id, token);
      setPhotos(gallery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event");
    } finally {
      setLoading(false);
    }
  }, [slug, session, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveSettings(eventForm: FormEvent) {
    eventForm.preventDefault();
    if (!event) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const updated = await updateEvent(
        event.id,
        {
          title,
          wedding_date: weddingDate || null,
          status,
          default_threshold: threshold,
          branding: {
            couple_names: coupleNames,
            accent_color: accentColor,
          },
        },
        token,
      );
      setEvent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!event || !files?.length) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      for (const file of Array.from(files)) {
        await uploadEventGalleryPhoto(event.id, file, token);
      }
      const gallery = await fetchEventGallery(event.id, token);
      setPhotos(gallery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (!event) {
      return;
    }
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await deleteEventGalleryPhoto(event.id, photoId, token);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(eventForm: FormEvent) {
    eventForm.preventDefault();
    if (!event || !inviteEmail.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await inviteEventMember(event.id, inviteEmail.trim(), token);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  function copyGuestLink() {
    void navigator.clipboard.writeText(guestUrl);
  }

  if (loading) {
    return (
      <div className="event-manage event-manage--loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-manage">
        <p className="error-banner">{error ?? "Event not found"}</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="event-manage">
        <h1>Manage event</h1>
        <p>You do not have permission to manage this event.</p>
        <Link to={`/e/${slug}`}>View guest page</Link>
      </div>
    );
  }

  return (
    <div className="event-manage">
      <header className="event-manage__header">
        <div>
          <p className="event-manage__eyebrow">Event admin</p>
          <h1>{event.title}</h1>
        </div>
        <Link className="btn btn-secondary" to={`/e/${slug}`}>
          Guest view
        </Link>
      </header>

      <section className="event-manage__section">
        <h2>Guest link</h2>
        <div className="event-manage__link-row">
          <code>{guestUrl}</code>
          <button type="button" className="btn btn-ghost" onClick={copyGuestLink}>
            Copy
          </button>
        </div>
        <p className="event-manage__hint">Share this link or QR code with wedding guests.</p>
      </section>

      <form className="event-manage__section" onSubmit={handleSaveSettings}>
        <h2>Branding & settings</h2>
        <label htmlFor="title">Event title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label htmlFor="couple">Couple names</label>
        <input id="couple" value={coupleNames} onChange={(e) => setCoupleNames(e.target.value)} />

        <label htmlFor="date">Wedding date</label>
        <input
          id="date"
          type="date"
          value={weddingDate}
          onChange={(e) => setWeddingDate(e.target.value)}
        />

        <label htmlFor="status">Status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as EventPublic["status"])}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>

        <label htmlFor="accent">Accent color</label>
        <input
          id="accent"
          type="color"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
        />

        <label htmlFor="threshold">Match threshold ({threshold.toFixed(2)})</label>
        <input
          id="threshold"
          type="range"
          min={0.2}
          max={0.8}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />

        <button type="submit" className="btn btn-primary" disabled={busy}>
          Save settings
        </button>
      </form>

      <section className="event-manage__section">
        <h2>Wedding album ({photos.length} photos)</h2>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => void handleUpload(e.target.files)}
        />
        <ul className="event-manage__gallery">
          {photos.map((photo) => (
            <li key={photo.id}>
              <span>{photo.filename ?? photo.id.slice(0, 8)}</span>
              <button type="button" className="btn btn-ghost" onClick={() => void handleDelete(photo.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="event-manage__section" onSubmit={handleInvite}>
        <h2>Invite co-admin</h2>
        <p className="event-manage__hint">They must sign up first, then you can invite by email.</p>
        <label htmlFor="invite">Partner email</label>
        <input
          id="invite"
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="partner@example.com"
        />
        <button type="submit" className="btn btn-secondary" disabled={busy || !inviteEmail.trim()}>
          Send invite
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
