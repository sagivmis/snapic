import { createTranslator } from "../i18n";
import type { MatchedPerson, MatchedPhoto } from "../types";

const { t } = createTranslator("common");

export function formatMatchedPerson(person: MatchedPerson | null | undefined): string | null {
  if (person == null) {
    return null;
  }
  if (person === "both") {
    return t("bothMatched");
  }
  return person === 1 ? t("person1") : t("person2");
}

export function formatPersonScores(photo: MatchedPhoto): string | null {
  const p1 = photo.person_1_score;
  const p2 = photo.person_2_score;
  if (p1 == null && p2 == null) {
    return null;
  }
  const parts: string[] = [];
  if (p1 != null) {
    parts.push(t("personScore", { person: 1, percent: (p1 * 100).toFixed(0) }));
  }
  if (p2 != null) {
    parts.push(t("personScore", { person: 2, percent: (p2 * 100).toFixed(0) }));
  }
  return parts.join(" · ");
}

export function filterCoupleMatches(
  items: MatchedPhoto[],
  filter: CoupleFilter,
): MatchedPhoto[] {
  if (filter === "all") {
    return items;
  }
  if (filter === "both") {
    return items.filter((item) => item.matched_person === "both");
  }
  return items.filter((item) => item.matched_person === Number(filter));
}

export type CoupleFilter = "all" | "1" | "2" | "both";

export type SortMode = "score" | "together-first";

export function sortMatches(items: MatchedPhoto[], mode: SortMode): MatchedPhoto[] {
  const sorted = [...items];
  if (mode === "together-first") {
    sorted.sort((a, b) => {
      const aBoth = a.matched_person === "both" ? 1 : 0;
      const bBoth = b.matched_person === "both" ? 1 : 0;
      if (aBoth !== bBoth) {
        return bBoth - aBoth;
      }
      return b.score - a.score;
    });
    return sorted;
  }
  sorted.sort((a, b) => b.score - a.score);
  return sorted;
}
