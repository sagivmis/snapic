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

/** Instant fingerprint for in-batch / filename dedup (no file read). */
export function fileClientKey(file: File): string {
  return `${file.name.toLowerCase()}|${file.size}|${file.lastModified}`;
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
