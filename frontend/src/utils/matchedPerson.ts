import type { MatchedPerson } from "../types";

export function formatMatchedPerson(person: MatchedPerson | null | undefined): string | null {
  if (person == null) {
    return null;
  }
  if (person === "both") {
    return "Both matched";
  }
  return `Person ${person}`;
}
