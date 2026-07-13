import type { Language } from "../types";
import { getLocalizedCountry } from "./i18n";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";

const topology = countries110m as unknown as {
  objects: {
    countries: Parameters<typeof feature>[1];
  };
};

const countries = feature(countries110m as never, topology.objects.countries) as unknown as {
  features: CountryFeature[];
};

export const countryFeatures = countries.features;

export type CountryFeature = {
  properties?: {
    name?: string;
  };
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type CountryLabel = {
  name: string;
  lat: number;
  lng: number;
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "China (Mainland)": "China",
  "Republic of Korea": "South Korea",
  "United States": "United States of America"
};

export function getCountryGeometryName(displayName: string): string {
  return COUNTRY_NAME_ALIASES[displayName] ?? displayName;
}

const COUNTRY_LABEL_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  "Hong Kong SAR": { lat: 22.3193, lng: 114.1694 },
  "Hong Kong SAR, China": { lat: 22.3193, lng: 114.1694 },
  Singapore: { lat: 1.3521, lng: 103.8198 }
};

function ringArea(ring: number[][]): number {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    area += current[0] * next[1] - next[0] * current[1];
  }

  return area / 2;
}

function ringCentroid(ring: number[][]): { lat: number; lng: number } | null {
  const area = ringArea(ring);

  if (!area) return null;

  let lngTotal = 0;
  let latTotal = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    const cross = current[0] * next[1] - next[0] * current[1];
    lngTotal += (current[0] + next[0]) * cross;
    latTotal += (current[1] + next[1]) * cross;
  }

  return {
    lat: latTotal / (6 * area),
    lng: lngTotal / (6 * area)
  };
}

function featureCentroid(country: CountryFeature): { lat: number; lng: number } | null {
  if (!country.geometry) return null;

  const polygons =
    country.geometry.type === "Polygon"
      ? [country.geometry.coordinates as number[][][]]
      : (country.geometry.coordinates as number[][][][]);

  const outerRings = polygons.map((polygon) => polygon[0]).filter(Boolean);
  const largestOuterRing = outerRings.reduce<number[][] | null>((largest, ring) => {
    if (!largest) return ring;
    return Math.abs(ringArea(ring)) > Math.abs(ringArea(largest)) ? ring : largest;
  }, null);

  return largestOuterRing ? ringCentroid(largestOuterRing) : null;
}

export function buildCountryLabels(
  universities: Array<{
    country: string;
    latitude: number;
    longitude: number;
  }>,
  language: Language = "en"
): CountryLabel[] {
  const labelCountries = [...new Set(universities.map((university) => university.country))];

  return labelCountries
    .map((displayName) => {
      const override = COUNTRY_LABEL_OVERRIDES[displayName];
      if (override) {
        return {
          name: getLocalizedCountry(displayName, language),
          lat: override.lat,
          lng: override.lng
        };
      }

      const geometryName = getCountryGeometryName(displayName);
      const country = countries.features.find((featureEntry) => featureEntry.properties?.name === geometryName);
      if (!country) return null;
      const centroid = featureCentroid(country);
      if (!centroid) return null;

      return {
        name: getLocalizedCountry(displayName, language),
        lat: centroid.lat,
        lng: centroid.lng
      };
    })
    .filter((label): label is CountryLabel => Boolean(label));
}
