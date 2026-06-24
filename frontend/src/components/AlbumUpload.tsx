import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryPhoto } from "../types";
import {
  collectFilesFromDataTransfer,
  filterImageFiles,
  prepareAlbumUploads,
} from "../utils/albumUpload";
import {
  bindUploadVisibilityHandlers,
  GalleryUploadQueue,
  type GalleryUploadCallbacks,
  type GalleryUploadProgress,
} from "../utils/galleryUploadQueue";
import {
  desktopUploadHint,
  isDesktopUpload,
  isMobileDevice,
  MOBILE_BATCH_RECOMMENDED,
  mobileUploadHint,
} from "../utils/uploadHints";
import { useTranslation } from "../i18n";
import "../styles/AlbumUpload.scss";

type UploadPhase = "idle" | "preparing" | "uploading" | "paused";

interface AlbumUploadProps {
  eventId: string;
  photos: GalleryPhoto[];
  getToken: () => Promise<string | null>;
  disabled?: boolean;
  section?: string;
  onPhotosChange: (photos: GalleryPhoto[]) => void;
  onError: (message: string | null) => void;
  onActiveChange?: (active: boolean) => void;
  onQueueIdle?: (summary: { uploaded: number; failed: number }) => void;
}

const INITIAL_PROGRESS: GalleryUploadProgress = {
  phase: "uploading",
  fileTotal: 0,
  activeCount: 0,
  currentFileNames: [],
  overallProgress: 0,
  processed: 0,
  uploaded: 0,
  failed: 0,
  skippedBeforeUpload: 0,
  skippedDuringUpload: 0,
};

const PREPARING_MESSAGE_MS = 1500;

export function AlbumUpload({
  eventId,
  photos,
  getToken,
  disabled = false,
  section,
  onPhotosChange,
  onError,
  onActiveChange,
  onQueueIdle,
}: AlbumUploadProps) {
  const { tPath } = useTranslation("components.albumUpload");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<GalleryUploadQueue | null>(null);
  const batchPhotosRef = useRef<GalleryPhoto[]>([]);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState<GalleryUploadProgress>(INITIAL_PROGRESS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [preparingCount, setPreparingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const desktopMode = useMemo(() => isDesktopUpload(), []);
  const mobileMode = useMemo(() => isMobileDevice(), []);
  const busy = phase === "preparing" || phase === "uploading" || phase === "paused";

  function formatUploadStatus(uploadProgress: GalleryUploadProgress): string {
    const processed = Math.min(
      uploadProgress.processed ??
        uploadProgress.uploaded + uploadProgress.failed + uploadProgress.skippedDuringUpload,
      uploadProgress.fileTotal,
    );
    const { fileTotal, uploaded, skippedBeforeUpload, skippedDuringUpload, failed, activeCount } =
      uploadProgress;
    const totalSkipped = skippedBeforeUpload + skippedDuringUpload;

    const detailParts: string[] = [];
    if (uploaded > 0) {
      detailParts.push(tPath("uploaded", { count: uploaded }));
    }
    if (totalSkipped > 0) {
      detailParts.push(tPath("skipped", { count: totalSkipped }));
    }
    if (failed > 0) {
      detailParts.push(tPath("failed", { count: failed }));
    }
    const detail = detailParts.length > 0 ? ` · ${detailParts.join(", ")}` : "";

    if (activeCount > 0 && processed >= fileTotal) {
      return tPath("finishing", { count: activeCount });
    }

    if (activeCount > 1) {
      return tPath("uploading", {
        processed,
        total: fileTotal,
        detail,
      });
    }

    return `${processed}/${fileTotal} processed${detail}`;
  }

  useEffect(() => {
    onActiveChange?.(busy);
  }, [busy, onActiveChange]);

  useEffect(() => {
    batchPhotosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!busy) {
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
  }, [busy]);

  function existingFilenames(): string[] {
    return batchPhotosRef.current
      .map((photo) => photo.filename)
      .filter((name): name is string => Boolean(name));
  }

  function existingClientKeys(): string[] {
    return queueRef.current?.getQueuedClientKeys() ?? [];
  }

  function createQueueCallbacks(): GalleryUploadCallbacks {
    return {
      getToken,
      onProgress: (next: GalleryUploadProgress) => setProgress(next),
      onPhotoUploaded: (photo: GalleryPhoto) => {
        batchPhotosRef.current = [...batchPhotosRef.current, photo];
        onPhotosChange([...batchPhotosRef.current]);
      },
      onError: (message: string) => onError(message),
      onComplete: ({
        uploaded,
        failed,
        skippedDuplicates,
      }: {
        uploaded: number;
        failed: number;
        skippedDuplicates: number;
      }) => {
        queueRef.current = null;
        setPhase("idle");

        const parts: string[] = [];
        if (uploaded > 0) {
          parts.push(
            tPath(uploaded === 1 ? "completeUploaded_one" : "completeUploaded_other", { count: uploaded }),
          );
        }
        if (skippedDuplicates > 0) {
          parts.push(
            tPath(
              skippedDuplicates === 1 ? "completeSkipped_one" : "completeSkipped_other",
              { count: skippedDuplicates },
            ),
          );
        }
        if (failed > 0) {
          parts.push(tPath("completeFailed", { count: failed }));
        }
        setStatusMessage(parts.join(" "));
        if (uploaded > 0 || failed > 0) {
          onQueueIdle?.({ uploaded, failed });
        }
      },
    };
  }

  async function ingestFiles(rawFiles: File[]) {
    const files = filterImageFiles(rawFiles);
    if (files.length === 0) {
      setStatusMessage(tPath("noImages"));
      return;
    }

    onError(null);
    setStatusMessage(null);

    if (files.length >= MOBILE_BATCH_RECOMMENDED) {
      setPreparingCount(files.length);
      setPhase("preparing");
      await new Promise((resolve) => window.setTimeout(resolve, PREPARING_MESSAGE_MS));
    }

    const prepared = prepareAlbumUploads(files, existingFilenames(), existingClientKeys());

    if (prepared.toUpload.length === 0) {
      setPhase("idle");
      setPreparingCount(0);
      setStatusMessage(
        prepared.skippedDuplicates > 0
          ? tPath("allDuplicates", { count: prepared.skippedDuplicates })
          : tPath("noPhotosSelected"),
      );
      return;
    }

    setPhase("uploading");
    setPreparingCount(0);
    setProgress((prev) => ({
      ...INITIAL_PROGRESS,
      fileTotal: prepared.toUpload.length,
      skippedBeforeUpload: prepared.skippedDuplicates,
      ...(queueRef.current ? prev : {}),
    }));

    if (queueRef.current?.hasPending) {
      queueRef.current.addBatch(prepared.toUpload, prepared.skippedDuplicates);
      return;
    }

    const queue = new GalleryUploadQueue(
      eventId,
      section,
      prepared.toUpload.length,
      prepared.skippedDuplicates,
      createQueueCallbacks(),
    );

    queueRef.current = queue;
    queue.enqueue(prepared.toUpload);

    try {
      await queue.start();
    } catch (err) {
      queueRef.current = null;
      setPhase("idle");
      onError(err instanceof Error ? err.message : tPath("uploadFailed"));
    }
  }

  async function handlePhotoInputChange(fileList: FileList | null) {
    if (!fileList?.length || disabled) {
      return;
    }
    await ingestFiles(Array.from(fileList));
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  async function handleFolderInputChange(fileList: FileList | null) {
    if (!fileList?.length || disabled) {
      return;
    }
    await ingestFiles(Array.from(fileList));
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  }

  function openPhotoPicker() {
    if (disabled || phase === "preparing") {
      return;
    }
    const queued = queueRef.current?.getQueuedClientKeys().length ?? 0;
    if (mobileMode && queued >= 50 && !window.confirm(tPath("queueConfirm"))) {
      return;
    }
    photoInputRef.current?.click();
  }

  function openFolderPicker() {
    if (disabled || phase === "preparing") {
      return;
    }
    folderInputRef.current?.click();
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (disabled || phase === "preparing") {
      return;
    }
    const files = await collectFilesFromDataTransfer(event.dataTransfer);
    await ingestFiles(files);
  }

  const preparingKey = preparingCount === 1 ? "preparing_one" : "preparing_other";

  return (
    <div className="album-upload">
      <input
        ref={photoInputRef}
        id="album-upload-photos"
        className="hidden-input"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => void handlePhotoInputChange(event.target.files)}
      />

      {desktopMode && (
        <input
          ref={folderInputRef}
          id="album-upload-folder"
          className="hidden-input"
          type="file"
          accept="image/*"
          multiple
          // @ts-expect-error non-standard directory picker attribute
          webkitdirectory=""
          directory=""
          disabled={disabled}
          onChange={(event) => void handleFolderInputChange(event.target.files)}
        />
      )}

      <div className="album-upload__actions">
        <button
          type="button"
          className="album-upload__picker"
          disabled={disabled || phase === "preparing"}
          onClick={openPhotoPicker}
        >
          {tPath("addPhotos")}
        </button>

        {desktopMode && (
          <button
            type="button"
            className="album-upload__picker album-upload__picker--secondary"
            disabled={disabled || phase === "preparing"}
            onClick={openFolderPicker}
          >
            {tPath("addFolder")}
          </button>
        )}
      </div>

      {desktopMode && (
        <div
          className={`album-upload__dropzone${dragOver ? " album-upload__dropzone--active" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) {
              setDragOver(false);
            }
          }}
          onDrop={(event) => void handleDrop(event)}
        >
          <p className="album-upload__dropzone-title">{tPath("dropTitle")}</p>
          <p className="album-upload__dropzone-desc">{desktopUploadHint()}</p>
        </div>
      )}

      <p className="album-upload__hint">
        {mobileMode ? mobileUploadHint() : desktopUploadHint()} {tPath("hintSuffix")}
      </p>

      {phase === "preparing" && (
        <div className="album-upload__progress" role="status" aria-live="polite">
          <strong>{tPath(preparingKey, { count: preparingCount })}</strong>
          <p className="album-upload__warning album-upload__warning--muted">{tPath("preparingHint")}</p>
        </div>
      )}

      {(phase === "uploading" || phase === "paused") && (
        <div className="album-upload__progress" role="status" aria-live="polite">
          <div className="album-upload__progress-header">
            <strong>
              {phase === "paused" ? tPath("paused") : formatUploadStatus(progress)}
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
            <p className="album-upload__warning album-upload__warning--muted">{tPath("iphonePause")}</p>
          ) : (
            <p className="album-upload__warning album-upload__warning--muted">{tPath("keepOpen")}</p>
          )}
        </div>
      )}

      {statusMessage && phase === "idle" && (
        <p className="album-upload__status">{statusMessage}</p>
      )}
    </div>
  );
}
