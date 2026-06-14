import { useEffect, useRef, useState } from "react";
import { uploadEventGalleryPhoto } from "../api/client";
import type { GalleryPhoto } from "../types";
import { prepareAlbumUploads } from "../utils/albumUpload";
import "../styles/AlbumUpload.scss";

type UploadPhase = "idle" | "scanning" | "uploading";

interface UploadProgress {
  phase: UploadPhase;
  scanCompleted: number;
  scanTotal: number;
  fileIndex: number;
  fileTotal: number;
  currentFileName: string;
  fileProgress: number;
  overallProgress: number;
  uploaded: number;
  skippedDuplicates: number;
}

const INITIAL_PROGRESS: UploadProgress = {
  phase: "idle",
  scanCompleted: 0,
  scanTotal: 0,
  fileIndex: 0,
  fileTotal: 0,
  currentFileName: "",
  fileProgress: 0,
  overallProgress: 0,
  uploaded: 0,
  skippedDuplicates: 0,
};

interface AlbumUploadProps {
  eventId: string;
  photos: GalleryPhoto[];
  getToken: () => Promise<string | null>;
  disabled?: boolean;
  section?: string;
  onPhotosChange: (photos: GalleryPhoto[]) => void;
  onError: (message: string | null) => void;
}

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
  const [progress, setProgress] = useState<UploadProgress>(INITIAL_PROGRESS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const uploading = progress.phase !== "idle";

  useEffect(() => {
    if (!uploading) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploading]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length || uploading) {
      return;
    }

    onError(null);
    setStatusMessage(null);

    const token = await getToken();
    if (!token) {
      onError("Not signed in");
      return;
    }

    const files = Array.from(fileList);
    setProgress({
      ...INITIAL_PROGRESS,
      phase: "scanning",
      scanTotal: files.length,
    });

    try {
      const existingFilenames = photos
        .map((photo) => photo.filename)
        .filter((name): name is string => Boolean(name));
      const existingHashes = photos
        .map((photo) => photo.content_hash)
        .filter((hash): hash is string => Boolean(hash));

      const prepared = await prepareAlbumUploads(
        files,
        existingFilenames,
        existingHashes,
        (completed, total) => {
          setProgress((current) => ({
            ...current,
            phase: "scanning",
            scanCompleted: completed,
            scanTotal: total,
            overallProgress: Math.round((completed / total) * 10),
          }));
        },
      );

      if (prepared.toUpload.length === 0) {
        setProgress(INITIAL_PROGRESS);
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

      const nextPhotos = [...photos];
      let uploadedCount = 0;

      setProgress({
        phase: "uploading",
        scanCompleted: files.length,
        scanTotal: files.length,
        fileIndex: 0,
        fileTotal: prepared.toUpload.length,
        currentFileName: prepared.toUpload[0]?.file.name ?? "",
        fileProgress: 0,
        overallProgress: 10,
        uploaded: 0,
        skippedDuplicates: prepared.skippedDuplicates,
      });

      for (let index = 0; index < prepared.toUpload.length; index += 1) {
        const item = prepared.toUpload[index];
        setProgress((current) => ({
          ...current,
          phase: "uploading",
          fileIndex: index + 1,
          fileTotal: prepared.toUpload.length,
          currentFileName: item.file.name,
          fileProgress: 0,
        }));

        try {
          const photo = await uploadEventGalleryPhoto(
            eventId,
            item.file,
            token,
            (loaded, total) => {
              const filePct = total > 0 ? loaded / total : 0;
              const overall = 10 + ((index + filePct) / prepared.toUpload.length) * 90;
              setProgress((current) => ({
                ...current,
                fileProgress: Math.round(filePct * 100),
                overallProgress: Math.min(100, Math.round(overall)),
              }));
            },
            section,
          );
          nextPhotos.push(photo);
          uploadedCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          if (message.toLowerCase().includes("already in the album")) {
            prepared.skippedDuplicates += 1;
            continue;
          }
          throw err;
        }
      }

      onPhotosChange(nextPhotos);
      setProgress(INITIAL_PROGRESS);

      const parts: string[] = [];
      if (uploadedCount > 0) {
        parts.push(`Uploaded ${uploadedCount} photo${uploadedCount === 1 ? "" : "s"}.`);
      }
      if (prepared.skippedDuplicates > 0) {
        parts.push(`Skipped ${prepared.skippedDuplicates} duplicate${prepared.skippedDuplicates === 1 ? "" : "s"}.`);
      }
      setStatusMessage(parts.join(" "));
    } catch (err) {
      setProgress(INITIAL_PROGRESS);
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

      <label htmlFor="album-upload-input" className={`album-upload__picker${uploading ? " album-upload__picker--disabled" : ""}`}>
        {uploading ? "Upload in progress…" : "Choose photos to upload"}
      </label>

      <p className="album-upload__hint">
        Duplicate photos are skipped automatically by filename and file content. Keep this tab open until
        the upload finishes — closing the browser will stop the upload.
      </p>

      {uploading && (
        <div className="album-upload__progress" role="status" aria-live="polite">
          <div className="album-upload__progress-header">
            <strong>
              {progress.phase === "scanning"
                ? `Checking duplicates (${progress.scanCompleted}/${progress.scanTotal})…`
                : `Uploading ${progress.fileIndex} of ${progress.fileTotal}`}
            </strong>
            <span>{progress.overallProgress}%</span>
          </div>

          {progress.phase === "uploading" && (
            <p className="album-upload__current-file">{progress.currentFileName}</p>
          )}

          <div className="album-upload__bar" aria-hidden="true">
            <div
              className="album-upload__bar-fill"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>

          {progress.phase === "uploading" && (
            <p className="album-upload__file-progress">Current file: {progress.fileProgress}%</p>
          )}

          <p className="album-upload__warning">
            Do not close this browser tab until the upload completes.
          </p>
        </div>
      )}

      {statusMessage && !uploading && <p className="album-upload__status">{statusMessage}</p>}
    </div>
  );
}
