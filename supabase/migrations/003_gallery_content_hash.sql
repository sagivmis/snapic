-- Content hash for duplicate detection on album uploads
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS gallery_photos_event_hash_idx
  ON public.gallery_photos(event_id, content_hash)
  WHERE content_hash IS NOT NULL;
