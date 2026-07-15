import type { RankingSource, University } from "../types";
import { getLocalizedSearchText } from "./i18n";

export function parseRankValue(rank: string): number {
  const parsedRank = Number(rank.replace(/=/g, ""));
  return Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : Number.POSITIVE_INFINITY;
}

export function getRankForSource(university: University, rankingSource: RankingSource): string {
  return rankingSource === "usNews" ? (university.usNewsGlobalRank ?? "") : university.rank2027;
}

export function getRankLabelForSource(university: University, rankingSource: RankingSource): string {
  const rank = getRankForSource(university, rankingSource);
  if (rank) return rankingSource === "usNews" ? `USN ${rank}` : `QS ${rank}`;

  const fallbackRank = rankingSource === "usNews" ? university.rank2027 : university.usNewsGlobalRank;
  if (fallbackRank) return rankingSource === "usNews" ? `QS ${fallbackRank}` : `USN ${fallbackRank}`;

  return "NR";
}

export function sortByRank(universities: University[], rankingSource: RankingSource = "qs"): University[] {
  return [...universities].sort((a, b) => {
    const primaryRankA = parseRankValue(getRankForSource(a, rankingSource));
    const primaryRankB = parseRankValue(getRankForSource(b, rankingSource));
    const secondaryRankA = parseRankValue(getRankForSource(a, rankingSource === "usNews" ? "qs" : "usNews"));
    const secondaryRankB = parseRankValue(getRankForSource(b, rankingSource === "usNews" ? "qs" : "usNews"));
    return primaryRankA - primaryRankB || secondaryRankA - secondaryRankB || a.name.localeCompare(b.name);
  });
}

export function searchUniversities(universities: University[], query: string): University[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return universities;

  return universities.filter((university) => getLocalizedSearchText(university).includes(normalizedQuery));
}
