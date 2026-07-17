import type { University } from "../types";
import type { RegionName } from "../types/mapModeTypes";

export function isUniversityInRegion(university: University, region: RegionName): boolean {
  if (region === "UK") return university.country === "United Kingdom";
  return university.region === region;
}

