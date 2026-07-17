import type { University } from "../types";
import type { RegionName } from "../types/mapModeTypes";

const DISPLAY_REGION_COUNTRIES: Partial<Record<RegionName, string>> = {
  UK: "United Kingdom",
  US: "United States of America",
  Australia: "Australia",
  "Hong Kong": "Hong Kong SAR, China"
};

export function isUniversityInRegion(university: University, region: RegionName): boolean {
  const displayCountry = DISPLAY_REGION_COUNTRIES[region];
  if (displayCountry) return university.country === displayCountry;
  return university.region === region;
}
