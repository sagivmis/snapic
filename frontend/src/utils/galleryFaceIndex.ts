import { createTranslator } from "../i18n";

export type IndexStreamResult = {
  processed: number;
  indexed: number;
  no_face: number;
  failed: number;
  thumbs_backfilled: number;
};

export function formatIndexResult(result: IndexStreamResult): string {
  const { tPath } = createTranslator("events.manage.indexResult");
  const parts: string[] = [];
  if (result.indexed > 0) {
    parts.push(tPath("indexed", { count: result.indexed }));
  }
  if (result.no_face > 0) {
    parts.push(tPath("noFace", { count: result.no_face }));
  }
  if (result.failed > 0) {
    parts.push(tPath("failed", { count: result.failed }));
  }
  if (parts.length === 0 && result.processed === 0) {
    return tPath("allIndexed");
  }
  return parts.length > 0 ? parts.join(", ") : tPath("processed", { count: result.processed });
}
