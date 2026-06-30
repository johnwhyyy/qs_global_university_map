import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";

const topology = countries110m as unknown as {
  objects: {
    countries: Parameters<typeof feature>[1];
  };
};

const countries = feature(countries110m as never, topology.objects.countries) as unknown as {
  features: object[];
};

export const countryFeatures = countries.features;

export type CountryLabel = {
  name: string;
  lat: number;
  lng: number;
};

export function buildCountryLabels(
  universities: Array<{
    country: string;
    latitude: number;
    longitude: number;
  }>
): CountryLabel[] {
  const grouped = new Map<string, { latitude: number; longitude: number; count: number }>();

  for (const university of universities) {
    const entry = grouped.get(university.country) ?? { latitude: 0, longitude: 0, count: 0 };
    entry.latitude += university.latitude;
    entry.longitude += university.longitude;
    entry.count += 1;
    grouped.set(university.country, entry);
  }

  return [...grouped.entries()].map(([name, value]) => ({
    name,
    lat: value.latitude / value.count,
    lng: value.longitude / value.count
  }));
}
