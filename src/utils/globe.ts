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
