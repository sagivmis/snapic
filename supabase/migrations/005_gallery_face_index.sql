-- Pre-computed face embeddings per gallery photo (speeds up guest matching)
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS face_embeddings JSONB,
  ADD COLUMN IF NOT EXISTS face_index_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (face_index_status IN ('pending', 'indexed', 'no_face', 'failed'));

CREATE INDEX IF NOT EXISTS gallery_photos_face_index_status_idx
  ON public.gallery_photos(event_id, face_index_status);
