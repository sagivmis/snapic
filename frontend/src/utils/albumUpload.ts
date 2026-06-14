export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface PreparedUpload {
  file: File;
  hash: string;
}

export interface PrepareUploadResult {
  toUpload: PreparedUpload[];
  skippedDuplicates: number;
  skippedNames: string[];
}

export async function prepareAlbumUploads(
  files: File[],
  existingFilenames: string[],
  existingHashes: string[],
  onScanProgress?: (completed: number, total: number) => void,
): Promise<PrepareUploadResult> {
  const filenameSet = new Set(existingFilenames.map((name) => name.toLowerCase()));
  const hashSet = new Set(existingHashes);
  const batchHashes = new Set<string>();
  const toUpload: PreparedUpload[] = [];
  const skippedNames: string[] = [];
  let skippedDuplicates = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onScanProgress?.(index + 1, files.length);

    const normalizedName = file.name.toLowerCase();
    if (filenameSet.has(normalizedName)) {
      skippedDuplicates += 1;
      skippedNames.push(file.name);
      continue;
    }

    const hash = await hashFile(file);
    if (hashSet.has(hash) || batchHashes.has(hash)) {
      skippedDuplicates += 1;
      skippedNames.push(file.name);
      continue;
    }

    batchHashes.add(hash);
    hashSet.add(hash);
    filenameSet.add(normalizedName);
    toUpload.push({ file, hash });
  }

  return { toUpload, skippedDuplicates, skippedNames };
}
