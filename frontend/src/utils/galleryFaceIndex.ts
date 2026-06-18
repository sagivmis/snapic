export type IndexStreamResult = {
  processed: number;
  indexed: number;
  no_face: number;
  failed: number;
  thumbs_backfilled: number;
};

export function formatIndexResult(result: IndexStreamResult): string {
  const parts: string[] = [];
  if (result.indexed > 0) {
    parts.push(`${result.indexed} indexed`);
  }
  if (result.no_face > 0) {
    parts.push(`${result.no_face} without faces`);
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  if (parts.length === 0 && result.processed === 0) {
    return "All photos were already indexed.";
  }
  return parts.length > 0 ? parts.join(", ") : `Processed ${result.processed} photo(s).`;
}
