import type { University } from "../types";
import { getLocalizedSearchText } from "./i18n";

export function parseRankValue(rank: string): number {
  return Number(rank.replace(/=/g, ""));
}

export function sortByRank(universities: University[]): University[] {
  return [...universities].sort((a, b) => {
    const rankA = parseRankValue(a.rank2027);
    const rankB = parseRankValue(b.rank2027);
    return rankA - rankB || a.name.localeCompare(b.name);
  });
}

export function searchUniversities(universities: University[], query: string): University[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return universities;

  return universities.filter((university) => getLocalizedSearchText(university).includes(normalizedQuery));
}
