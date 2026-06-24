import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  buildEventGuestUrl,
  bulkDeleteEventGalleryPhotos,
  deleteEventGalleryPhoto,
  downloadEventGalleryZip,
  fetchEventAlbumStatus,
  fetchEventBySlug,
  fetchEventGallery,
  fetchEventGallerySections,
  fetchEventStats,
  fetchGalleryPreviewUrls,
  inviteEventMember,
  reindexEventGallery,
  updateEvent,
  updateGalleryPhotoSection,
} from "../api/client";
import { AlbumGrid, type AlbumGridHandle } from "../components/AlbumGrid";
import { AlbumStatusBanner } from "../components/AlbumStatusBanner";
import { AlbumUpload } from "../components/AlbumUpload";
import { EventManageSkeleton } from "../components/EventManageSkeleton";
import { GuestQrCode } from "../components/GuestQrCode";
import { useAuth } from "../auth/AuthProvider";
import type { EventAlbumStatus, EventPublic, EventStats, GalleryPhoto, IndexScope } from "../types";
import type { IndexStreamEvent } from "../api/client";
import { formatIndexResult } from "../utils/galleryFaceIndex";
import { canManageEvent } from "../utils/eventAccess";
import "../styles/EventManage.scss";

type ManageTab = "album" | "settings";

const DEFAULT_SECTIONS = ["general", "ceremony", "reception", "portraits", "party"];

const PREVIEW_URL_BATCH = 48;

export function EventManagePage() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { getAccessToken, session, isSuperAdmin, isPhotographer } = useAuth();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState<Extract<
    IndexStreamEvent,
    { type: "progress" }
  > | null>(null);
  const [albumStatus, setAlbumStatus] = useState<EventAlbumStatus | null>(null);
  const [uploadActive, setUploadActive] = useState(false);
  const [activeTab, setActiveTab] = useState<ManageTab>("album");
  const [albumSection, setAlbumSection] = useState<string>("all");

  const [title, setTitle] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [status, setStatus] = useState<EventPublic["status"]>("draft");
  const [coupleNames, setCoupleNames] = useState("");
  const [accentColor, setAccentColor] = useState("#c9a962");
  const [threshold, setThreshold] = useState(0.4);
  const [autoCloseDays, setAutoCloseDays] = useState(90);
  const [inviteEmail, setInviteEmail] = useState("");
  const albumGridRef = useRef<AlbumGridHandle>(null);
  const previewLoadGeneration = useRef(0);
  const autoIndexTimerRef = useRef<number | null>(null);
  const indexingRef = useRef(false);

  const guestUrl = useMemo(() => (slug ? buildEventGuestUrl(slug) : ""), [slug]);

  const filteredPhotos = useMemo(() => {
    if (albumSection === "all") {
      return photos;
    }
    return photos.filter((photo) => (photo.section ?? "general") === albumSection);
  }, [photos, albumSection]);

  const sectionTabs = useMemo(() => {
    const merged = new Set<string>(["all", ...sections]);
    for (const photo of photos) {
      merged.add(photo.section ?? "general");
    }
    return Array.from(merged);
  }, [sections, photos]);

  const refreshAlbumStatus = useCallback(async () => {
    if (!event) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const status = await fetchEventAlbumStatus(event.id, token);
      setAlbumStatus(status);
    } catch {
      // Non-blocking status refresh
    }
  }, [event, getAccessToken]);

  useEffect(() => {
    indexingRef.current = indexing;
  }, [indexing]);

  useEffect(() => {
    return () => {
      if (autoIndexTimerRef.current) {
        window.clearTimeout(autoIndexTimerRef.current);
      }
    };
  }, []);

  const load = useCallback(async () => {
    if (!slug || !session) {
      return;
    }
    const generation = previewLoadGeneration.current + 1;
    previewLoadGeneration.current = generation;
    setBootstrapping(true);
    setGalleryLoading(true);
    setPreviewsLoading(false);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const ev = await fetchEventBySlug(slug, token);
      setEvent(ev);
      setTitle(ev.title);
      setWeddingDate(ev.wedding_date ?? "");
      setStatus(ev.status);
      setThreshold(ev.default_threshold);
      setAutoCloseDays(ev.auto_close_days ?? 90);
      const branding = ev.branding ?? {};
      setCoupleNames(typeof branding.couple_names === "string" ? branding.couple_names : "");
      setAccentColor(typeof branding.accent_color === "string" ? branding.accent_color : "#c9a962");

      const hasMembership = await canManageEvent(ev, token, isSuperAdmin);
      setIsAdmin(hasMembership);
      setBootstrapping(false);

      if (!hasMembership) {
        return;
      }

      const [gallery, gallerySections, eventStats] = await Promise.all([
        fetchEventGallery(ev.id, token),
        fetchEventGallerySections(ev.id, token).catch(() => DEFAULT_SECTIONS),
        fetchEventStats(ev.id, token).catch(() => null),
      ]);
      if (previewLoadGeneration.current !== generation) {
        return;
      }
      setPhotos(gallery);
      setSections(gallerySections.length > 0 ? gallerySections : DEFAULT_SECTIONS);
      setStats(eventStats);
      setGalleryLoading(false);
      void fetchEventAlbumStatus(ev.id, token).then(setAlbumStatus).catch(() => {});

      if (gallery.length === 0) {
        return;
      }

      setPreviewsLoading(true);
      for (let offset = 0; offset < gallery.length; offset += PREVIEW_URL_BATCH) {
        if (previewLoadGeneration.current !== generation) {
          return;
        }
        const batch = await fetchGalleryPreviewUrls(ev.id, token, offset, PREVIEW_URL_BATCH);
        if (previewLoadGeneration.current !== generation) {
          return;
        }
        const urls = batch.urls;
        setPhotos((prev) =>
          prev.map((photo) => (urls[photo.id] ? { ...photo, signed_url: urls[photo.id] } : photo)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load event");
    } finally {
      if (previewLoadGeneration.current === generation) {
        setBootstrapping(false);
        setGalleryLoading(false);
        setPreviewsLoading(false);
      }
    }
  }, [slug, session, getAccessToken, isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!event || !isAdmin) {
      return;
    }
    void refreshAlbumStatus();
  }, [event, isAdmin, photos.length, refreshAlbumStatus]);

  useEffect(() => {
    if (!event || !isAdmin) {
      return;
    }
    const shouldPoll =
      uploadActive ||
      indexing ||
      albumStatus?.indexing_in_progress ||
      (albumStatus?.pending_count ?? 0) > 0;
    if (!shouldPoll) {
      return;
    }
    const interval = window.setInterval(() => void refreshAlbumStatus(), 5000);
    return () => window.clearInterval(interval);
  }, [event, isAdmin, uploadActive, indexing, albumStatus, refreshAlbumStatus]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "album" || tab === "settings") {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    if (bootstrapping || !event || !isAdmin || event.onboarding_completed_at || event.status !== "draft") {
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.get("from") === "setup" || params.get("from") === "studio") {
      return;
    }
    navigate(`/e/${slug}/setup`, { replace: true });
  }, [bootstrapping, event, isAdmin, location.search, navigate, slug]);

  async function handleSaveSettings(eventForm: FormEvent) {
    eventForm.preventDefault();
    if (!event) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
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
          auto_close_days: autoCloseDays,
          branding: {
            couple_names: coupleNames,
            accent_color: accentColor,
          },
        },
        token,
      );
      setEvent(updated);
      setSuccess("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (!event) {
      return;
    }
    if (!window.confirm("Remove this photo from the album?")) {
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

  async function handleBulkDelete(photoIds: string[]) {
    if (!event || photoIds.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const result = await bulkDeleteEventGalleryPhotos(event.id, photoIds, token);
      const removed = new Set(photoIds);
      setPhotos((prev) => prev.filter((photo) => !removed.has(photo.id)));
      const parts = [`Removed ${result.deleted} photo${result.deleted === 1 ? "" : "s"}.`];
      if (result.not_found > 0) {
        parts.push(`${result.not_found} were already gone.`);
      }
      setSuccess(parts.join(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSectionChange(photoId: string, section: string) {
    if (!event) {
      return;
    }
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const updated = await updateGalleryPhotoSection(event.id, photoId, section, token);
      setPhotos((prev) => prev.map((photo) => (photo.id === photoId ? updated : photo)));
      if (!sections.includes(section)) {
        setSections((prev) => [...prev, section].sort());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update section");
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
    setSuccess(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await inviteEventMember(event.id, inviteEmail.trim(), token);
      setInviteEmail("");
      setSuccess("Invite sent — they will receive an email to join as admin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReindexFaces(options?: { scope?: IndexScope; auto?: boolean }) {
    if (!event) {
      return;
    }
    const scope = options?.scope ?? "all";
    setIndexing(true);
    setIndexProgress(null);
    if (!options?.auto) {
      setError(null);
      setSuccess(null);
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const result = await reindexEventGallery(
        event.id,
        token,
        (progress) => {
          setIndexProgress(progress);
        },
        scope,
      );
      await refreshAlbumStatus();
      const refreshedEvent = await fetchEventBySlug(slug, token);
      setEvent(refreshedEvent);
      if (scope === "failed" && result.processed === 0) {
        if (!options?.auto) {
          setSuccess("No failed photos to retry.");
        }
        return;
      }
      if (!options?.auto) {
        setSuccess(formatIndexResult(result));
      } else if (result.indexed > 0 || result.processed > 0) {
        setSuccess(
          `Indexed ${result.indexed} new photo${result.indexed === 1 ? "" : "s"} automatically after upload.`,
        );
      }
    } catch (err) {
      if (!options?.auto) {
        setError(err instanceof Error ? err.message : "Indexing failed");
      }
    } finally {
      setIndexing(false);
      setIndexProgress(null);
      void refreshAlbumStatus();
    }
  }

  function scheduleAutoIndex() {
    if (autoIndexTimerRef.current) {
      window.clearTimeout(autoIndexTimerRef.current);
    }
    autoIndexTimerRef.current = window.setTimeout(() => {
      void runAutoIndex();
    }, 2000);
  }

  async function runAutoIndex() {
    if (!event || indexingRef.current || uploadActive) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const status = await fetchEventAlbumStatus(event.id, token);
      setAlbumStatus(status);
      if (status.pending_count > 0 && !status.indexing_in_progress) {
        await handleReindexFaces({ scope: "pending", auto: true });
      }
    } catch {
      // Auto-index is best-effort
    }
  }

  function handleUploadQueueIdle(summary: { uploaded: number; failed: number }) {
    if (summary.uploaded > 0) {
      scheduleAutoIndex();
    }
    void refreshAlbumStatus();
  }

  async function handleDownloadZip() {
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
      await downloadEventGalleryZip(event.id, token, `${event.slug}-album.zip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  function copyGuestLink() {
    void navigator.clipboard.writeText(guestUrl);
    setSuccess("Guest link copied.");
  }

  if (bootstrapping) {
    return <EventManageSkeleton />;
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
        {event.organization_id ? (
          <Link to={`/studio/clients/${event.id}`}>Back to studio client</Link>
        ) : (
          <Link to={`/e/${slug}`}>View guest page</Link>
        )}
      </div>
    );
  }

  const needsSetup = !event.onboarding_completed_at && event.status === "draft";
  const fromSetup = new URLSearchParams(location.search).get("from") === "setup";
  const fromStudio = new URLSearchParams(location.search).get("from") === "studio";
  const allowAlbumUpload = !event.photographer_led || isSuperAdmin || isPhotographer || isAdmin;

  return (
    <div className="event-manage">
      {fromSetup && needsSetup && (
        <div className="event-manage__setup-return">
          <Link to={`/e/${slug}/setup`} className="btn btn-primary">
            ← Back to setup checklist
          </Link>
          <p>Return here after uploading — your checklist will update automatically.</p>
        </div>
      )}
      {needsSetup && !fromSetup && !fromStudio && (
        <div className="event-manage__setup-banner">
          <div>
            <strong>Finish setting up your gallery</strong>
            <p>Complete branding and review your launch checklist.</p>
          </div>
          <Link to={`/e/${slug}/setup`} className="btn btn-secondary">
            Continue setup
          </Link>
        </div>
      )}
      <header className="event-manage__header">
        <div>
          <p className="event-manage__eyebrow">Event admin</p>
          <h1>{event.title}</h1>
        </div>
        <div className="event-manage__header-actions">
          <Link className="btn btn-secondary" to={`/e/${slug}`}>
            Guest view
          </Link>
          {isSuperAdmin && (
            <Link className="btn btn-ghost" to="/admin">
              Admin dashboard
            </Link>
          )}
        </div>
      </header>

      {stats && (
        <section className="event-manage__stats" aria-label="Event analytics">
          <div className="event-manage__stat">
            <span className="event-manage__stat-value">{stats.match_run_count}</span>
            <span className="event-manage__stat-label">Searches</span>
          </div>
          <div className="event-manage__stat">
            <span className="event-manage__stat-value">{stats.unique_guest_sessions}</span>
            <span className="event-manage__stat-label">Unique guests</span>
          </div>
          <div className="event-manage__stat">
            <span className="event-manage__stat-value">{stats.gallery_photo_count}</span>
            <span className="event-manage__stat-label">Album photos</span>
          </div>
          <div className="event-manage__stat">
            <span className="event-manage__stat-value">
              {stats.last_match_at
                ? new Date(stats.last_match_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
            <span className="event-manage__stat-label">Last search</span>
          </div>
        </section>
      )}

      <nav className="event-manage__tabs" aria-label="Event management">
        <button
          type="button"
          className={`event-manage__tab${activeTab === "album" ? " event-manage__tab--active" : ""}`}
          onClick={() => setActiveTab("album")}
        >
          Album
          <span className="event-manage__tab-count">{photos.length}</span>
        </button>
        <button
          type="button"
          className={`event-manage__tab${activeTab === "settings" ? " event-manage__tab--active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </nav>

      {activeTab === "album" && (
        <section className="event-manage__section">
          <div className="event-manage__section-header">
            <h2>Wedding album</h2>
            <div className="event-manage__section-actions">
              <p className="event-manage__hint">
                {galleryLoading
                  ? "Loading album…"
                  : previewsLoading
                    ? `Loading previews… ${photos.filter((photo) => photo.signed_url).length} of ${photos.length}`
                    : `${photos.length} photos in the album`}
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || filteredPhotos.length === 0}
                onClick={() => albumGridRef.current?.selectAll()}
              >
                Select all{filteredPhotos.length > 0 ? ` (${filteredPhotos.length})` : ""}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || indexing || photos.length === 0}
                onClick={() => void handleReindexFaces()}
              >
                {indexing ? "Indexing…" : "Index faces"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || photos.length === 0}
                onClick={() => void handleDownloadZip()}
              >
                Download ZIP
              </button>
            </div>
          </div>

          <AlbumStatusBanner
            status={albumStatus}
            uploadActive={uploadActive}
            indexing={indexing}
            indexProgress={indexProgress}
            retryDisabled={busy || indexing || uploadActive}
            onRetryFailed={() => void handleReindexFaces({ scope: "failed" })}
          />

          <nav className="event-manage__sections" aria-label="Album sections">
            {sectionTabs.map((section) => (
              <button
                key={section}
                type="button"
                className={`event-manage__section-tab${albumSection === section ? " event-manage__section-tab--active" : ""}`}
                onClick={() => setAlbumSection(section)}
              >
                {section === "all" ? "All photos" : section}
              </button>
            ))}
          </nav>

          <AlbumUpload
            eventId={event.id}
            photos={photos}
            getToken={getAccessToken}
            disabled={busy || galleryLoading || !allowAlbumUpload}
            section={albumSection === "all" ? "general" : albumSection}
            onPhotosChange={setPhotos}
            onError={setError}
            onActiveChange={setUploadActive}
            onQueueIdle={handleUploadQueueIdle}
          />
          {!allowAlbumUpload && (
            <p className="event-manage__hint">
              Your photographer manages album uploads. You can remove individual photos if needed.
            </p>
          )}

          {galleryLoading ? (
            <div className="event-manage__gallery-skeleton" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="event-manage__gallery-skeleton-tile" />
              ))}
            </div>
          ) : (
            <AlbumGrid
              ref={albumGridRef}
              photos={filteredPhotos}
              onDelete={(id) => void handleDelete(id)}
              onBulkDelete={(ids) => handleBulkDelete(ids)}
              onSectionChange={(id, section) => void handleSectionChange(id, section)}
              sectionOptions={sections.filter((section) => section !== "all")}
              disabled={busy}
              previewLoading={previewsLoading}
            />
          )}
        </section>
      )}

      {activeTab === "settings" && (
        <>
          <section className="event-manage__section">
            <h2>Guest link & QR</h2>
            <div className="event-manage__link-row">
              <code>{guestUrl}</code>
              <button type="button" className="btn btn-ghost" onClick={copyGuestLink}>
                Copy
              </button>
            </div>
            <p className="event-manage__hint">Share this link or QR code with wedding guests at the venue.</p>
            <GuestQrCode url={guestUrl} eventTitle={event.title} coupleNames={coupleNames || undefined} />
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
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventPublic["status"])}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
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

            <label htmlFor="close-days">Auto-close after wedding (days)</label>
            <input
              id="close-days"
              type="number"
              min={7}
              max={365}
              value={autoCloseDays}
              onChange={(e) => setAutoCloseDays(Number(e.target.value))}
            />

            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save settings
            </button>
          </form>

          <form className="event-manage__section" onSubmit={handleInvite}>
            <h2>Invite co-admin</h2>
            <p className="event-manage__hint">
              We will email them a sign-in link. After they join, they can manage this event.
            </p>
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
        </>
      )}

      {success && <p className="event-manage__success">{success}</p>}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
