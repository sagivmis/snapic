export interface PreparedUpload {
  file: File;
  /** Fast client key — server still dedupes by content hash. */
  clientKey: string;
}

export interface PrepareUploadResult {
  toUpload: PreparedUpload[];
  skippedDuplicates: number;
  skippedNames: string[];
}

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

/** Instant fingerprint for in-batch / filename dedup (no file read). */
export function fileClientKey(file: File): string {
  return `${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  const dot = file.name.lastIndexOf(".");
  if (dot === -1) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(file.name.slice(dot).toLowerCase());
}

export function filterImageFiles(files: File[]): File[] {
  return files.filter(isImageFile);
}

async function collectFromEntry(
  entry: FileSystemEntry | null,
  files: File[],
): Promise<void> {
  if (!entry) {
    return;
  }
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    if (isImageFile(file)) {
      files.push(file);
    }
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    await readAllDirectoryEntries(reader, files);
  }
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
  files: File[],
): Promise<void> {
  const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
  if (batch.length === 0) {
    return;
  }
  await Promise.all(batch.map((entry) => collectFromEntry(entry, files)));
  await readAllDirectoryEntries(reader, files);
}

/** Walk dropped files and folders (nested Lightroom-style exports). */
export async function collectFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<File[]> {
  const files: File[] = [];
  const items = [...dataTransfer.items];

  if (items.length > 0 && items.some((item) => item.kind === "file")) {
    await Promise.all(
      items
        .filter((item) => item.kind === "file")
        .map((item) => collectFromEntry(item.webkitGetAsEntry(), files)),
    );
  }

  if (files.length === 0 && dataTransfer.files.length > 0) {
    files.push(...filterImageFiles(Array.from(dataTransfer.files)));
  }

  return files;
}

export function prepareAlbumUploads(
  files: File[],
  existingFilenames: string[],
  existingClientKeys: string[] = [],
): PrepareUploadResult {
  const filenameSet = new Set(existingFilenames.map((name) => name.toLowerCase()));
  const keySet = new Set(existingClientKeys);
  const batchKeys = new Set<string>();
  const toUpload: PreparedUpload[] = [];
  const skippedNames: string[] = [];
  let skippedDuplicates = 0;

  for (const file of files) {
    const normalizedName = file.name.toLowerCase();
    const clientKey = fileClientKey(file);

    if (filenameSet.has(normalizedName)) {
      skippedDuplicates += 1;
      skippedNames.push(file.name);
      continue;
    }

    if (keySet.has(clientKey) || batchKeys.has(clientKey)) {
      skippedDuplicates += 1;
      skippedNames.push(file.name);
      continue;
    }

    batchKeys.add(clientKey);
    keySet.add(clientKey);
    filenameSet.add(normalizedName);
    toUpload.push({ file, clientKey });
  }

  return { toUpload, skippedDuplicates, skippedNames };
}
