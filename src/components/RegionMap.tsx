import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { RotateCcw } from "lucide-react";
import { SHOW_MAP_DEBUG_OVERLAY } from "../config/debug";
import cityCentersData from "../data/city-centers.json";
import topCountryCitiesData from "../data/top-country-cities.json";
import usPriorityCitiesData from "../data/us-priority-cities.json";
import usStateCapitalsData from "../data/us-state-capitals.json";
import type { HoverState, Language, University } from "../types";
import type { RegionName } from "../types/mapModeTypes";
import { assetPath } from "../utils/asset";
import {
  buildCountryLabels,
  countryFeatures,
  getCountryGeometryName,
  type CountryFeature
} from "../utils/globe";
import { getLocalizedCity, getUiString } from "../utils/i18n";

type RegionMapProps = {
  universities: University[];
  region: RegionName;
  language: Language;
  activeUniversity: University | null;
  focusRequest: { university: University; id: number } | null;
  onSelect: (university: University) => void;
  onClusterSelect?: (universities: University[]) => void;
  onHover: (hover: HoverState) => void;
  onHoverEnd: () => void;
};

type TopCity = {
  city: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
  population: number;
  isCapital: boolean;
  isStateCapital?: boolean;
};

const topCountryCities = topCountryCitiesData as TopCity[];
const universityCityCenters = cityCentersData as TopCity[];
const usPriorityCities = usPriorityCitiesData as TopCity[];
const usStateCapitals = (usStateCapitalsData as TopCity[]).map((city) => ({
  ...city,
  population: city.population ?? 0,
  isCapital: false,
  isStateCapital: true
}));

const REGION_MARKER_SIZE = 32.8;
const REGION_CLUSTER_DISTANCE = REGION_MARKER_SIZE * (2 / 3);
const MIN_REGION_SCALE = 0.65;
const MAX_REGION_SCALE = 20;
const REGION_ZOOM_SLIDER_STEP = 0.35;
const FOCUSED_REGION_SCALE = 2.15;
const REGION_ZOOM_INTENSITY = 0.0018;
const REGION_CITY_LABEL_MIN_SCALE = 2.5;
const AMERICAS_STATE_CAPITAL_CITY_LABEL_MIN_SCALE = 15;
const ASIA_CAPITAL_CITY_LABEL_MIN_SCALE = 6.5;
const ASIA_OTHER_CITY_LABEL_MIN_SCALE = 10;
const EUROPE_CAPITAL_CITY_LABEL_MIN_SCALE = 3.5;
const EUROPE_OTHER_CITY_LABEL_MIN_SCALE = 7;
const REGION_CITY_LABEL_OVERLAP_DISTANCE = 36;
const REGION_CITY_LABEL_OFFSET_X = 76;
const REGION_CITY_LABEL_OFFSET_Y = -24;
const REGION_CITY_LABEL_STACK_GAP = 18;
const REGION_CITY_LABEL_MAX_ALIGN_DISTANCE = 118;
const REGION_CITY_LABEL_VIEWPORT_MARGIN = 28;
const REGION_START_VIEWS: Partial<Record<RegionName, { latitude: number; longitude: number; scale: number }>> = {
  Americas: { latitude: 42.939, longitude: -98.3069, scale: 3.88 },
  Asia: { latitude: 28.2674, longitude: 106.7436, scale: 6.5 },
  Europe: { latitude: 51.0277, longitude: 5.8551, scale: 3.52 }
};
const REGION_CONTEXT_COUNTRIES: Record<RegionName, string[]> = {
  Americas: [
    "Argentina",
    "Brazil",
    "Canada",
    "Chile",
    "Colombia",
    "Mexico",
    "Peru",
    "United States of America"
  ],
  Asia: [
    "Afghanistan",
    "Bangladesh",
    "Brunei",
    "Cambodia",
    "China",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Israel",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kuwait",
    "Laos",
    "Lebanon",
    "Malaysia",
    "Mongolia",
    "Myanmar",
    "Nepal",
    "North Korea",
    "Oman",
    "Pakistan",
    "Philippines",
    "Qatar",
    "Russia",
    "Saudi Arabia",
    "South Korea",
    "Sri Lanka",
    "Syria",
    "Thailand",
    "Turkey",
    "United Arab Emirates",
    "Uzbekistan",
    "Vietnam"
  ],
  Europe: [
    "Austria",
    "Belgium",
    "Czechia",
    "Denmark",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Ireland",
    "Italy",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Spain",
    "Sweden",
    "Switzerland",
    "United Kingdom"
  ],
  Oceania: ["Australia", "New Zealand"]
};

type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

type RegionMarkerPoint = {
  university: University;
  screen: { x: number; y: number };
};

type RegionMarkerCluster = {
  key: string;
  universities: University[];
  screen: { x: number; y: number };
};

type RegionCityLabelPlacement = {
  key: string;
  name: string;
  isCapital: boolean;
  anchor: { x: number; y: number };
  label: { x: number; y: number };
  isOffset: boolean;
};

function parseRank(rank: string): number {
  return Number(rank.replace(/=/g, ""));
}

function projectPoint(
  projection: ReturnType<typeof geoMercator>,
  latitude: number,
  longitude: number
): { x: number; y: number } | null {
  const projected = projection([longitude, latitude]);
  return projected ? { x: projected[0], y: projected[1] } : null;
}

function useElementSize() {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 700 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ width: rect.width, height: rect.height });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function applyTransform(point: { x: number; y: number }, transform: ViewTransform) {
  return {
    x: point.x * transform.scale + transform.x,
    y: point.y * transform.scale + transform.y
  };
}

function clusterKey(universities: University[]): string {
  return universities.map((university) => university.name).sort().join("|");
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildRegionMarkerClusters(points: RegionMarkerPoint[]): RegionMarkerCluster[] {
  const parent = new Map<string, string>();

  const find = (value: string): string => {
    const current = parent.get(value) ?? value;
    if (current === value) return current;
    const root = find(current);
    parent.set(value, root);
    return root;
  };

  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (let index = 0; index < points.length; index += 1) {
    for (let other = index + 1; other < points.length; other += 1) {
      if (distance(points[index].screen, points[other].screen) <= REGION_CLUSTER_DISTANCE) {
        union(points[index].university.name, points[other].university.name);
      }
    }
  }

  const groups = new Map<string, RegionMarkerPoint[]>();
  for (const point of points) {
    const root = find(point.university.name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(point);
  }

  return [...groups.values()].map((group) => {
    const universities = group.map((point) => point.university).sort((a, b) => parseRank(a.rank2027) - parseRank(b.rank2027));
    const screen = group.reduce(
      (acc, point) => {
        acc.x += point.screen.x;
        acc.y += point.screen.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    screen.x /= group.length;
    screen.y /= group.length;

    return {
      key: clusterKey(universities),
      universities,
      screen
    };
  });
}

function getInitialRegionTransform(
  region: RegionName,
  universities: University[],
  projection: ReturnType<typeof geoMercator>,
  size: { width: number; height: number }
): ViewTransform {
  const fixedView = REGION_START_VIEWS[region];
  if (fixedView && size.width > 0 && size.height > 0) {
    const projectedCenter = projectPoint(projection, fixedView.latitude, fixedView.longitude);
    if (projectedCenter) {
      return {
        scale: fixedView.scale,
        x: size.width / 2 - projectedCenter.x * fixedView.scale,
        y: size.height / 2 - projectedCenter.y * fixedView.scale
      };
    }
  }

  const shouldFocusOnUniversityCentroid = region === "Americas" || region === "Europe";
  if (!shouldFocusOnUniversityCentroid || size.width <= 0 || size.height <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const focusUniversities =
    region === "Americas"
      ? universities.filter((university) => university.country !== "Argentina")
      : universities;
  const projectedPoints = focusUniversities
    .map((university) => projectPoint(projection, university.latitude, university.longitude))
    .filter((point): point is { x: number; y: number } => Boolean(point));

  if (projectedPoints.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const centroid = projectedPoints.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  centroid.x /= projectedPoints.length;
  centroid.y /= projectedPoints.length;

  return {
    scale: FOCUSED_REGION_SCALE,
    x: size.width / 2 - centroid.x * FOCUSED_REGION_SCALE,
    y: size.height / 2 - centroid.y * FOCUSED_REGION_SCALE
  };
}

function isRegionCityLabelVisible(region: RegionName, city: TopCity, scale: number): boolean {
  if (region === "Americas" && city.isStateCapital) {
    return scale > AMERICAS_STATE_CAPITAL_CITY_LABEL_MIN_SCALE;
  }
  if (region === "Asia") {
    return city.isCapital ? scale >= ASIA_CAPITAL_CITY_LABEL_MIN_SCALE : scale > ASIA_OTHER_CITY_LABEL_MIN_SCALE;
  }
  if (region !== "Europe") return scale >= REGION_CITY_LABEL_MIN_SCALE;
  return city.isCapital ? scale > EUROPE_CAPITAL_CITY_LABEL_MIN_SCALE : scale > EUROPE_OTHER_CITY_LABEL_MIN_SCALE;
}

function cityKey(city: Pick<TopCity, "city" | "country">): string {
  return `${city.city.toLowerCase()}|${city.country.toLowerCase()}`;
}

function uniqueCities(cities: TopCity[]): TopCity[] {
  return [...new Map(cities.map((city) => [cityKey(city), city])).values()];
}

function shouldIncludeRegionCity(region: RegionName, city: TopCity): boolean {
  if (region !== "Asia") return true;
  if (city.country === "Taiwan") return city.city === "Taipei";
  if (city.country === "Hong Kong SAR, China") return city.city === "Hong Kong";
  if (city.country === "Singapore") return city.city === "Singapore";
  return true;
}

function isPointInViewport(point: { x: number; y: number }, size: { width: number; height: number }): boolean {
  return (
    point.x >= -REGION_CITY_LABEL_VIEWPORT_MARGIN &&
    point.x <= size.width + REGION_CITY_LABEL_VIEWPORT_MARGIN &&
    point.y >= -REGION_CITY_LABEL_VIEWPORT_MARGIN &&
    point.y <= size.height + REGION_CITY_LABEL_VIEWPORT_MARGIN
  );
}

function alignOffsetCityLabels(placements: RegionCityLabelPlacement[], height: number): RegionCityLabelPlacement[] {
  const nextPlacements = [...placements];
  const offsetPlacements = nextPlacements.filter((placement) => placement.isOffset);
  const sides = [
    offsetPlacements.filter((placement) => placement.label.x >= placement.anchor.x),
    offsetPlacements.filter((placement) => placement.label.x < placement.anchor.x)
  ];

  for (const sidePlacements of sides) {
    if (sidePlacements.length < 2) continue;

    const sortedPlacements = sidePlacements.sort((a, b) => a.label.y - b.label.y);
    const groups: RegionCityLabelPlacement[][] = [];

    for (const placement of sortedPlacements) {
      const currentGroup = groups[groups.length - 1];
      const previousPlacement = currentGroup?.[currentGroup.length - 1];

      if (previousPlacement && placement.label.y - previousPlacement.label.y < REGION_CITY_LABEL_STACK_GAP) {
        currentGroup!.push(placement);
      } else {
        groups.push([placement]);
      }
    }

    for (const group of groups) {
      if (group.length < 2) continue;

      const alignedX =
        group[0].label.x >= group[0].anchor.x
          ? Math.max(...group.map((placement) => placement.label.x))
          : Math.min(...group.map((placement) => placement.label.x));
      let previousY = -Infinity;

      for (const placement of group) {
        const nextY = Math.max(placement.label.y, previousY + REGION_CITY_LABEL_STACK_GAP);
        const alignedLabel = {
          x: alignedX,
          y: Math.min(Math.max(28, nextY), Math.max(28, height - 28))
        };

        if (distance(alignedLabel, placement.anchor) <= REGION_CITY_LABEL_MAX_ALIGN_DISTANCE) {
          placement.label = alignedLabel;
          previousY = placement.label.y;
        } else {
          previousY = Math.max(previousY, placement.label.y);
        }
      }
    }
  }

  return nextPlacements;
}

export function RegionMap({
  universities,
  region,
  language,
  activeUniversity,
  focusRequest,
  onSelect,
  onClusterSelect,
  onHover,
  onHoverEnd
}: RegionMapProps) {
  const { ref, size } = useElementSize();
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );
  const activePointers = useRef(new Map<number, PointerPosition>());
  const pinchState = useRef<{
    startDistance: number;
    startMidpoint: PointerPosition;
    originX: number;
    originY: number;
    originScale: number;
  } | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const viewTransformRef = useRef(viewTransform);
  const [isDragging, setIsDragging] = useState(false);
  const regionUniversities = useMemo(
    () => universities.filter((university) => university.region === region),
    [region, universities]
  );
  const regionCountries = useMemo(
    () => [...new Set(regionUniversities.map((university) => university.country))],
    [regionUniversities]
  );
  const regionSchoolGeometryNames = useMemo(
    () => new Set(regionCountries.map(getCountryGeometryName)),
    [regionCountries]
  );
  const regionCountryFeatures = useMemo(() => {
    const geometryNames = new Set([
      ...regionCountries.map(getCountryGeometryName),
      ...REGION_CONTEXT_COUNTRIES[region]
    ]);
    return countryFeatures.filter((feature) => feature.properties?.name && geometryNames.has(feature.properties.name));
  }, [region, regionCountries]);

  const regionFeatureCollection = useMemo(
    () =>
      ({
        type: "FeatureCollection",
        features: regionCountryFeatures
      }) as FeatureCollection,
    [regionCountryFeatures]
  );

  // Region view is a separate projected map, not a globe camera move. d3-geo fits the existing world-atlas geometry.
  const projection = useMemo(() => {
    const nextProjection = geoMercator();
    if (regionCountryFeatures.length > 0 && size.width > 0 && size.height > 0) {
      nextProjection.fitExtent(
        [
          [42, 70],
          [Math.max(120, size.width - 42), Math.max(160, size.height - 48)]
        ],
        regionFeatureCollection
      );
    }
    return nextProjection;
  }, [regionCountryFeatures.length, regionFeatureCollection, size.height, size.width]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const countryLabels = useMemo(
    () =>
      buildCountryLabels(regionUniversities, language)
        .map((label) => {
          const screen = projectPoint(projection, label.lat, label.lng);
          return screen ? { ...label, screen } : null;
        })
        .filter((label): label is { name: string; lat: number; lng: number; screen: { x: number; y: number } } =>
          Boolean(label)
        ),
    [language, projection, regionUniversities]
  );
  const cityLabels = useMemo(() => {
    const countrySet = new Set(regionCountries);

    const sourceCities =
      region === "Europe"
        ? (() => {
            const europeCities = new Map<string, TopCity>();
            for (const city of topCountryCities) {
              if (countrySet.has(city.country) && city.isCapital) {
                europeCities.set(cityKey(city), city);
              }
            }

            for (const university of regionUniversities) {
              const cityCenter = universityCityCenters.find(
                (city) => city.city === university.city && city.country === university.country
              );
              const universityCity: TopCity = {
                city: university.city,
                country: university.country,
                latitude: cityCenter?.latitude ?? university.latitude,
                longitude: cityCenter?.longitude ?? university.longitude,
                population: cityCenter?.population ?? 0,
                isCapital: cityCenter?.isCapital ?? false
              };
              const key = cityKey(universityCity);
              const existingCity = europeCities.get(key);
              europeCities.set(key, {
                ...universityCity,
                isCapital: existingCity?.isCapital || universityCity.isCapital
              });
            }

            return [...europeCities.values()];
          })()
        : uniqueCities([
            ...topCountryCities.filter((city) => countrySet.has(city.country)),
            ...(region === "Americas" && countrySet.has("United States of America") ? usPriorityCities : []),
            ...(region === "Americas" && countrySet.has("United States of America") ? usStateCapitals : [])
          ]);

    return sourceCities
      .filter((city) => shouldIncludeRegionCity(region, city))
      .map((city) => {
        const screen = projectPoint(projection, city.latitude, city.longitude);
        return screen
          ? {
              ...city,
              name: getLocalizedCity(city.city, language),
              screen
            }
          : null;
      })
      .filter(
        (
          city
        ): city is TopCity & {
          name: string;
          screen: { x: number; y: number };
        } => Boolean(city)
      );
  }, [language, projection, region, regionCountries, regionUniversities]);
  const markerPoints = useMemo(
    () =>
      regionUniversities
        .map((university) => {
          const screen = projectPoint(projection, university.latitude, university.longitude);
          return screen ? { university, screen } : null;
        })
        .filter((point): point is { university: University; screen: { x: number; y: number } } => Boolean(point)),
    [projection, regionUniversities]
  );
  const markerClusters = useMemo(
    () =>
      buildRegionMarkerClusters(
        markerPoints.map(({ university, screen }) => ({
          university,
          screen: applyTransform(screen, viewTransform)
        }))
    ),
    [markerPoints, viewTransform]
  );
  const debugCenter = useMemo(() => {
    if (!SHOW_MAP_DEBUG_OVERLAY) return null;

    const projectedCenter: [number, number] = [
      (size.width / 2 - viewTransform.x) / viewTransform.scale,
      (size.height / 2 - viewTransform.y) / viewTransform.scale
    ];
    const inverted = projection.invert?.(projectedCenter);
    return inverted ? { longitude: inverted[0], latitude: inverted[1] } : null;
  }, [projection, size.height, size.width, viewTransform]);
  const cityLabelPlacements = useMemo<RegionCityLabelPlacement[]>(
    () => {
      const placements = cityLabels.flatMap((city) => {
          if (!isRegionCityLabelVisible(region, city, viewTransform.scale)) return [];
          const anchor = applyTransform(city.screen, viewTransform);
          if (!isPointInViewport(anchor, size)) return [];

          const overlapsMarker = markerClusters.some(
            (cluster) => distance(anchor, cluster.screen) <= REGION_CITY_LABEL_OVERLAP_DISTANCE
          );
          const offsetDirection = anchor.x < size.width * 0.68 ? 1 : -1;

          return {
            key: `${city.city}-${city.country}`,
            name: city.name,
            isCapital: city.isCapital,
            anchor,
            label: overlapsMarker
              ? {
                  x: anchor.x + REGION_CITY_LABEL_OFFSET_X * offsetDirection,
                  y: anchor.y + REGION_CITY_LABEL_OFFSET_Y
                }
              : anchor,
            isOffset: overlapsMarker
          };
        });

      return alignOffsetCityLabels(placements, size.height);
    },
    [cityLabels, markerClusters, region, size.height, size.width, viewTransform]
  );

  useEffect(() => {
    setViewTransform(getInitialRegionTransform(region, regionUniversities, projection, size));
    setIsDragging(false);
    dragState.current = null;
    activePointers.current.clear();
    pinchState.current = null;
  }, [projection, region, regionUniversities, size]);

  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);

  useEffect(() => {
    const preventBrowserPinch = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest(".region-map-stage")) {
        event.preventDefault();
      }
    };

    document.addEventListener("gesturestart", preventBrowserPinch, { passive: false });
    document.addEventListener("gesturechange", preventBrowserPinch, { passive: false });
    document.addEventListener("gestureend", preventBrowserPinch, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventBrowserPinch);
      document.removeEventListener("gesturechange", preventBrowserPinch);
      document.removeEventListener("gestureend", preventBrowserPinch);
    };
  }, []);

  useEffect(() => {
    if (!focusRequest || focusRequest.university.region !== region) return;

    const screen = projectPoint(projection, focusRequest.university.latitude, focusRequest.university.longitude);
    if (!screen) return;

    setViewTransform((current) => ({
      ...current,
      x: size.width / 2 - screen.x * current.scale,
      y: size.height / 2 - screen.y * current.scale
    }));
  }, [focusRequest, projection, region, size.height, size.width]);

  const resetRegionView = () => {
    setViewTransform(getInitialRegionTransform(region, regionUniversities, projection, size));
    activePointers.current.clear();
    pinchState.current = null;
    dragState.current = null;
    setIsDragging(false);
  };

  const setZoomFromSlider = (event: ChangeEvent<HTMLInputElement>) => {
    const nextScale = Number(event.target.value);
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    setViewTransform((current) => {
      const scaleRatio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: centerX - (centerX - current.x) * scaleRatio,
        y: centerY - (centerY - current.y) * scaleRatio
      };
    });
  };

  const adjustZoomFromSliderWheel = (event: ReactWheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const direction = event.deltaY > 0 ? -1 : 1;
    const nextScale = Math.max(
      MIN_REGION_SCALE,
      Math.min(MAX_REGION_SCALE, viewTransformRef.current.scale + direction * REGION_ZOOM_SLIDER_STEP)
    );
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    setViewTransform((current) => {
      const scaleRatio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: centerX - (centerX - current.x) * scaleRatio,
        y: centerY - (centerY - current.y) * scaleRatio
      };
    });
  };

  const zoomAtPoint = (cursorX: number, cursorY: number, deltaY: number) => {
    setViewTransform((current) => {
      const nextScale = Math.max(
        MIN_REGION_SCALE,
        Math.min(MAX_REGION_SCALE, current.scale * Math.exp(-deltaY * REGION_ZOOM_INTENSITY))
      );
      const scaleRatio = nextScale / current.scale;

      return {
        scale: nextScale,
        x: cursorX - (cursorX - current.x) * scaleRatio,
        y: cursorY - (cursorY - current.y) * scaleRatio
      };
    });
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".map-zoom-control")) return;

      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAtPoint(event.clientX - rect.left, event.clientY - rect.top, event.deltaY);
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleNativeWheel);
  }, [ref, zoomAtPoint]);

  const getPointerPosition = (event: PointerEvent<HTMLElement>): PointerPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const getPinchGeometry = () => {
    const pointers = [...activePointers.current.values()];
    if (pointers.length < 2) return null;

    const [first, second] = pointers;
    return {
      distance: Math.max(1, distance(first, second)),
      midpoint: {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2
      }
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input, .map-zoom-control")) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, getPointerPosition(event));

    if (activePointers.current.size >= 2) {
      const pinch = getPinchGeometry();
      if (pinch) {
        const current = viewTransformRef.current;
        pinchState.current = {
          startDistance: pinch.distance,
          startMidpoint: pinch.midpoint,
          originX: current.x,
          originY: current.y,
          originScale: current.scale
        };
        dragState.current = null;
        setIsDragging(true);
      }
      return;
    }

    const pointer = getPointerPosition(event);
    dragState.current = {
      pointerId: event.pointerId,
      startX: pointer.x,
      startY: pointer.y,
      originX: viewTransform.x,
      originY: viewTransform.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (activePointers.current.has(event.pointerId)) {
      event.preventDefault();
      activePointers.current.set(event.pointerId, getPointerPosition(event));
    }

    const pinch = pinchState.current;
    if (pinch && activePointers.current.size >= 2) {
      const nextPinch = getPinchGeometry();
      if (!nextPinch) return;

      const nextScale = Math.max(
        MIN_REGION_SCALE,
        Math.min(MAX_REGION_SCALE, pinch.originScale * (nextPinch.distance / pinch.startDistance))
      );
      const scaleRatio = nextScale / pinch.originScale;

      setViewTransform({
        scale: nextScale,
        x: nextPinch.midpoint.x - (pinch.startMidpoint.x - pinch.originX) * scaleRatio,
        y: nextPinch.midpoint.y - (pinch.startMidpoint.y - pinch.originY) * scaleRatio
      });
      return;
    }

    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointer = getPointerPosition(event);

    setViewTransform((current) => ({
      ...current,
      x: drag.originX + pointer.x - drag.startX,
      y: drag.originY + pointer.y - drag.startY
    }));
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    activePointers.current.delete(event.pointerId);

    if (activePointers.current.size < 2) {
      pinchState.current = null;
    }

    if (activePointers.current.size === 1) {
      const [[pointerId, pointer]] = activePointers.current;
      const current = viewTransformRef.current;
      dragState.current = {
        pointerId,
        startX: pointer.x,
        startY: pointer.y,
        originX: current.x,
        originY: current.y
      };
      setIsDragging(true);
      return;
    }

    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
    }

    setIsDragging(false);
  };

  return (
    <section
      ref={ref}
      className={`region-map-stage ${isDragging ? "is-dragging" : ""}`}
      aria-label={`${region} region map`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <svg className="region-map-svg" viewBox={`0 0 ${size.width} ${size.height}`} role="img">
        <rect width={size.width} height={size.height} className="region-map-ocean" />
        <g transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}>
          {regionCountryFeatures.map((feature: CountryFeature) => (
            <path
              key={feature.properties?.name}
              d={path(feature as never) ?? ""}
              className={`region-country-shape ${
                regionSchoolGeometryNames.has(feature.properties?.name ?? "") ? "has-schools" : "is-context"
              }`}
            />
          ))}
        </g>
      </svg>

      <button className="map-reset-button" type="button" onClick={resetRegionView} aria-label="Reset map view">
        <RotateCcw size={18} />
        <span>Reset Zoom</span>
      </button>

      <label className="map-zoom-control" aria-label="Regional map zoom level">
        <span>{MAX_REGION_SCALE}x</span>
        <input
          type="range"
          min={MIN_REGION_SCALE}
          max={MAX_REGION_SCALE}
          step="0.01"
          value={viewTransform.scale}
          onChange={setZoomFromSlider}
          onWheel={adjustZoomFromSliderWheel}
        />
        <span>{viewTransform.scale.toFixed(1)}x</span>
      </label>

      <div className="region-map-overlay" aria-hidden={false}>
        {countryLabels.map((label) => (
          (() => {
            const transformed = applyTransform(label.screen, viewTransform);
            return (
          <div
            key={`${label.name}-${label.lat}-${label.lng}`}
            className="country-label screen-country-label"
            style={{ left: `${transformed.x}px`, top: `${transformed.y}px`, fontSize: "0.86rem" }}
          >
            {label.name}
          </div>
            );
          })()
        ))}

        {cityLabelPlacements.length > 0 && (
          <svg className="region-city-connectors" width={size.width} height={size.height} aria-hidden="true">
            {cityLabelPlacements
              .filter((city) => city.isOffset)
              .map((city) => (
                <line
                  key={`${city.key}-connector`}
                  x1={city.anchor.x}
                  y1={city.anchor.y}
                  x2={city.label.x}
                  y2={city.label.y}
                  className={`city-connector ${city.isCapital ? "is-capital" : ""}`}
                />
              ))}
          </svg>
        )}

        {cityLabelPlacements.length > 0 &&
          cityLabelPlacements.map((city) => (
          <div
            key={city.key}
            className={`city-label screen-city-label ${city.isCapital ? "is-capital" : ""}`}
            style={{ left: `${city.label.x}px`, top: `${city.label.y}px`, zIndex: city.isCapital ? 950 : 900 }}
          >
            <span className="city-dot" />
            <span className="city-name">{city.name}</span>
          </div>
          ))}

        {markerClusters.map((cluster) => {
          const topUniversity = cluster.universities[0];
          const hiddenCount = cluster.universities.length - 1;
          const isCluster = hiddenCount > 0;
          const containsActiveUniversity = activeUniversity
            ? cluster.universities.some((university) => university.name === activeUniversity.name)
            : false;
          const displayUniversity =
            containsActiveUniversity && activeUniversity ? activeUniversity : topUniversity;

          return (
            <button
              key={cluster.key}
              className={`marker screen-marker ${containsActiveUniversity ? "is-active" : ""} ${
                isCluster ? "is-cluster" : ""
              }`}
              style={{
                left: `${cluster.screen.x}px`,
                top: `${cluster.screen.y}px`,
                width: `${REGION_MARKER_SIZE}px`,
                height: `${REGION_MARKER_SIZE}px`,
                zIndex: containsActiveUniversity ? 2200 : 1200 - parseRank(topUniversity.rank2027)
              }}
              type="button"
              aria-label={
                isCluster
                  ? `${cluster.universities.length} university cluster, showing ${displayUniversity.name}`
                  : `${displayUniversity.rank2027}: ${displayUniversity.name}`
              }
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onHover(
                  isCluster
                    ? {
                        type: "cluster",
                        universities: cluster.universities,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 12
                      }
                    : {
                        type: "university",
                        university: displayUniversity,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 12
                      }
                );
              }}
              onMouseMove={(event) => {
                onHover(
                  isCluster
                    ? {
                        type: "cluster",
                        universities: cluster.universities,
                        x: event.clientX,
                        y: event.clientY - 18
                      }
                    : {
                        type: "university",
                        university: displayUniversity,
                        x: event.clientX,
                        y: event.clientY - 18
                      }
                );
              }}
              onMouseLeave={onHoverEnd}
              onClick={() => {
                if (isCluster && onClusterSelect) {
                  onClusterSelect(cluster.universities);
                  return;
                }
                onSelect(displayUniversity);
              }}
            >
              <img src={assetPath(displayUniversity.logoPath)} alt="" />
              {isCluster ? <span className="cluster-count">+{hiddenCount}</span> : <span>{displayUniversity.rank2027}</span>}
            </button>
          );
        })}
      </div>

      <div className="globe-caption">{getUiString(language, "globeCaption")}</div>
      {SHOW_MAP_DEBUG_OVERLAY && debugCenter ? (
        <div className="map-debug-overlay" aria-hidden="true">
          <span>{region}</span>
          <span>center {debugCenter.latitude.toFixed(4)}, {debugCenter.longitude.toFixed(4)}</span>
          <span>zoom {viewTransform.scale.toFixed(2)}x</span>
          <span>pan {viewTransform.x.toFixed(0)}, {viewTransform.y.toFixed(0)}</span>
        </div>
      ) : null}
    </section>
  );
}
