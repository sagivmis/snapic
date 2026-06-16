import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "../types";
import { prepareAlbumUploads } from "../utils/albumUpload";
import {
  bindUploadVisibilityHandlers,
  GalleryUploadQueue,
  type GalleryUploadProgress,
} from "../utils/galleryUploadQueue";
import "../styles/AlbumUpload.scss";

type UploadPhase = "idle" | "uploading" | "paused";

interface AlbumUploadProps {
  eventId: string;
  photos: GalleryPhoto[];
  getToken: () => Promise<string | null>;
  disabled?: boolean;
  section?: string;
  onPhotosChange: (photos: GalleryPhoto[]) => void;
  onError: (message: string | null) => void;
}

const INITIAL_PROGRESS: GalleryUploadProgress = {
  phase: "uploading",
  fileTotal: 0,
  activeCount: 0,
  currentFileNames: [],
  overallProgress: 0,
  uploaded: 0,
  failed: 0,
  skippedDuplicates: 0,
};

export function AlbumUpload({
  eventId,
  photos,
  getToken,
  disabled = false,
  section,
  onPhotosChange,
  onError,
}: AlbumUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<GalleryUploadQueue | null>(null);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<GalleryUploadProgress>(INITIAL_PROGRESS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const uploading = phase !== "idle";

  useEffect(() => {
    if (!uploading) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queueRef.current?.hasPending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    const unbindVisibility = bindUploadVisibilityHandlers(
      () => Boolean(queueRef.current?.hasPending),
      () => {
        queueRef.current?.resumeIfNeeded();
        setPhase("uploading");
      },
      () => {
        queueRef.current?.pause();
        setPhase("paused");
      },
    );

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unbindVisibility();
    };
  }, [uploading]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length || uploading) {
      return;
    }

    onError(null);
    setStatusMessage(null);

    const files = Array.from(fileList);
    const existingFilenames = photos
      .map((photo) => photo.filename)
      .filter((name): name is string => Boolean(name));

    const prepared = prepareAlbumUploads(files, existingFilenames);

    if (prepared.toUpload.length === 0) {
      setStatusMessage(
        prepared.skippedDuplicates > 0
          ? `All ${prepared.skippedDuplicates} selected photo(s) are already in the album.`
          : "No photos selected.",
      );
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setPhase("uploading");
    setProgress({
      ...INITIAL_PROGRESS,
      fileTotal: prepared.toUpload.length,
      skippedDuplicates: prepared.skippedDuplicates,
    });

    const batchPhotos = [...photos];

    const queue = new GalleryUploadQueue(
      eventId,
      section,
      prepared.toUpload.length,
      prepared.skippedDuplicates,
      {
        getToken,
        onProgress: (next) => setProgress(next),
        onPhotoUploaded: (photo) => {
          batchPhotos.push(photo);
          onPhotosChange([...batchPhotos]);
        },
        onError: (message) => onError(message),
        onComplete: ({ uploaded, failed, skippedDuplicates }) => {
          queueRef.current = null;
          setPhase("idle");

          const parts: string[] = [];
          if (uploaded > 0) {
            parts.push(`Uploaded ${uploaded} photo${uploaded === 1 ? "" : "s"}.`);
          }
          if (skippedDuplicates > 0) {
            parts.push(
              `Skipped ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"}.`,
            );
          }
          if (failed > 0) {
            parts.push(`${failed} failed — try again or check your connection.`);
          }
          setStatusMessage(parts.join(" "));
        },
      },
    );

    queueRef.current = queue;
    queue.enqueue(prepared.toUpload);

    try {
      await queue.start();
    } catch (err) {
      queueRef.current = null;
      setPhase("idle");
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="album-upload">
      <input
        ref={inputRef}
        id="album-upload-input"
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || uploading}
        onChange={(event) => void handleFilesSelected(event.target.files)}
      />

      <label
        htmlFor="album-upload-input"
        className={`album-upload__picker${uploading ? " album-upload__picker--disabled" : ""}`}
      >
        {uploading ? "Upload in progress…" : "Choose photos to upload"}
      </label>

      <p className="album-upload__hint">
        Uploads start immediately. Duplicates are skipped by filename; identical files are caught
        on the server. You can switch apps — return to this tab to resume if uploads pause.
      </p>

      {uploading && (
        <div className="album-upload__progress" role="status" aria-live="polite">
          <div className="album-upload__progress-header">
            <strong>
              {phase === "paused"
                ? "Upload paused — return to this tab to continue"
                : progress.activeCount > 1
                  ? `Uploading ${progress.activeCount} photos at once (${progress.uploaded}/${progress.fileTotal} done)`
                  : progress.currentFileNames[0]
                    ? `Uploading ${progress.currentFileNames[0]}`
                    : `Uploading (${progress.uploaded}/${progress.fileTotal} done)`}
            </strong>
            <span>{progress.overallProgress}%</span>
          </div>

          {progress.currentFileNames.length > 1 && phase === "uploading" && (
            <p className="album-upload__current-file">
              {progress.currentFileNames.slice(0, 3).join(", ")}
              {progress.currentFileNames.length > 3
                ? ` +${progress.currentFileNames.length - 3} more`
                : ""}
            </p>
          )}

          <div className="album-upload__bar" aria-hidden="true">
            <div
              className="album-upload__bar-fill"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>

          {phase === "paused" ? (
            <p className="album-upload__warning album-upload__warning--muted">
              On iPhone, Safari pauses uploads when you leave the app. Open Snapic again to
              continue — nothing is lost.
            </p>
          ) : (
            <p className="album-upload__warning album-upload__warning--muted">
              Keep this page open for fastest uploads. Closing the browser will cancel remaining
              files.
            </p>
          )}
        </div>
      )}

      {statusMessage && !uploading && <p className="album-upload__status">{statusMessage}</p>}
    </div>
  );
}
