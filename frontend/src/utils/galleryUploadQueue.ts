import { uploadEventGalleryPhoto } from "../api/client";
import type { GalleryPhoto } from "../types";
import type { PreparedUpload } from "./albumUpload";

export interface GalleryUploadProgress {
  phase: "uploading" | "paused";
  fileTotal: number;
  activeCount: number;
  currentFileNames: string[];
  overallProgress: number;
  uploaded: number;
  failed: number;
  skippedDuplicates: number;
}

export interface GalleryUploadCallbacks {
  getToken: () => Promise<string | null>;
  onProgress: (progress: GalleryUploadProgress) => void;
  onPhotoUploaded: (photo: GalleryPhoto) => void;
  onComplete: (summary: { uploaded: number; failed: number; skippedDuplicates: number }) => void;
  onError: (message: string) => void;
}

interface QueueItem extends PreparedUpload {
  attempts: number;
}

const DEFAULT_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

export class GalleryUploadQueue {
  private pending: QueueItem[] = [];

  private running = 0;

  private uploaded = 0;

  private failed = 0;

  private skippedDuplicates: number;

  private totalFiles: number;

  private cancelled = false;

  private processing = false;

  private wakeLock: WakeLockSentinel | null = null;

  private inFlightProgress = new Map<string, number>();

  private activeNames = new Set<string>();

  constructor(
    private eventId: string,
    private section: string | undefined,
    totalFiles: number,
    initialSkipped: number,
    private callbacks: GalleryUploadCallbacks,
  ) {
    this.totalFiles = totalFiles;
    this.skippedDuplicates = initialSkipped;
  }

  enqueue(prepared: PreparedUpload[]): void {
    this.pending.push(...prepared.map((item) => ({ ...item, attempts: 0 })));
  }

  async start(concurrency = DEFAULT_CONCURRENCY): Promise<void> {
    if (this.processing || this.cancelled || this.pending.length === 0) {
      return;
    }

    this.processing = true;
    await this.acquireWakeLock();
    this.emitProgress("uploading");

    const workerCount = Math.min(concurrency, this.pending.length);
    await Promise.all(Array.from({ length: workerCount }, () => this.workerLoop()));

    this.processing = false;
    await this.releaseWakeLock();

    if (!this.cancelled && this.pending.length === 0 && this.running === 0) {
      this.callbacks.onComplete({
        uploaded: this.uploaded,
        failed: this.failed,
        skippedDuplicates: this.skippedDuplicates,
      });
    }
  }

  /** Call when the tab becomes visible again — resumes workers if uploads stalled. */
  resumeIfNeeded(): void {
    if (this.cancelled || (this.pending.length === 0 && this.running === 0)) {
      return;
    }
    void this.acquireWakeLock().then(() => this.start());
  }

  pause(): void {
    this.emitProgress("paused");
  }

  cancel(): void {
    this.cancelled = true;
    this.pending = [];
    void this.releaseWakeLock();
  }

  get hasPending(): boolean {
    return !this.cancelled && (this.pending.length > 0 || this.running > 0 || this.processing);
  }

  private async workerLoop(): Promise<void> {
    while (!this.cancelled) {
      const item = this.pending.shift();
      if (!item) {
        return;
      }

      this.running += 1;
      this.activeNames.add(item.file.name);
      this.inFlightProgress.set(item.file.name, 0);
      this.emitProgress("uploading");

      try {
        const token = await this.callbacks.getToken();
        if (!token) {
          throw new Error("Not signed in");
        }

        const photo = await uploadEventGalleryPhoto(
          this.eventId,
          item.file,
          token,
          (loaded, total) => {
            this.inFlightProgress.set(item.file.name, total > 0 ? loaded / total : 0);
            this.emitProgress("uploading");
          },
          this.section,
        );

        this.uploaded += 1;
        this.callbacks.onPhotoUploaded(photo);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        if (message.toLowerCase().includes("already in the album")) {
          this.skippedDuplicates += 1;
        } else if (item.attempts + 1 < MAX_ATTEMPTS && !this.cancelled) {
          item.attempts += 1;
          this.pending.push(item);
        } else {
          this.failed += 1;
          this.callbacks.onError(`${item.file.name}: ${message}`);
        }
      } finally {
        this.running -= 1;
        this.activeNames.delete(item.file.name);
        this.inFlightProgress.delete(item.file.name);
        this.emitProgress("uploading");
      }
    }
  }

  private emitProgress(phase: GalleryUploadProgress["phase"]): void {
    const finished = this.uploaded + this.failed + this.skippedDuplicates;
    const inFlightSum = [...this.inFlightProgress.values()].reduce((sum, value) => sum + value, 0);
    const overall =
      this.totalFiles > 0
        ? Math.min(100, Math.round(((finished + inFlightSum) / this.totalFiles) * 100))
        : 0;

    this.callbacks.onProgress({
      phase,
      fileTotal: this.totalFiles,
      activeCount: this.running,
      currentFileNames: [...this.activeNames],
      overallProgress: overall,
      uploaded: this.uploaded,
      failed: this.failed,
      skippedDuplicates: this.skippedDuplicates,
    });
  }

  private async acquireWakeLock(): Promise<void> {
    if (!("wakeLock" in navigator) || this.wakeLock) {
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = null;
      });
    } catch {
      // Optional — not available on all devices
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (!this.hasPending) {
      try {
        await this.wakeLock?.release();
      } catch {
        // Ignored
      }
      this.wakeLock = null;
    }
  }
}

export function bindUploadVisibilityHandlers(
  isUploading: () => boolean,
  onVisible: () => void,
  onHidden: () => void,
): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      onHidden();
      return;
    }
    if (isUploading()) {
      onVisible();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}
