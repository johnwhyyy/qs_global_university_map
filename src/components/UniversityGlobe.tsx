import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, WheelEvent as ReactWheelEvent } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { RotateCcw } from "lucide-react";
import * as THREE from "three";
import { SHOW_MAP_DEBUG_OVERLAY } from "../config/debug";
import { GLOBE_ZOOM } from "../config/globeZoom";
import type { HoverState, Language, RankingSource, University } from "../types";
import { assetPath } from "../utils/asset";
import cityCentersData from "../data/city-centers.json";
import topCountryCitiesData from "../data/top-country-cities.json";
import { getLocalizedCity, getUiString } from "../utils/i18n";
import { getRankForSource } from "../utils/universitySearch";
import { buildCountryLabels, countryFeatures } from "../utils/globe";

type UniversityGlobeProps = {
  universities: University[];
  language: Language;
  rankingSource: RankingSource;
  activeUniversity: University | null;
  panelFocusRequest: { university: University; id: number } | null;
  listResetRequest: number;
  onSelect: (university: University) => void;
  onClusterSelect?: (universities: University[]) => void;
  onHover: (hover: HoverState) => void;
  onHoverEnd: () => void;
};

type ScreenPoint = {
  x: number;
  y: number;
};

type MarkerCluster = {
  key: string;
  universities: University[];
  screen: ScreenPoint;
};

type ScreenCountryLabel = {
  key: string;
  name: string;
  screen: ScreenPoint;
};

type CityCenter = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  geonamesCityId: number;
  featureCode: string;
  isCapital: boolean;
  population: number;
  source: string;
  sourceUrl: string;
};

type ScreenCityLabel = {
  key: string;
  name: string;
  isCapital: boolean;
  screen: ScreenPoint;
};

type GlobeDebugState = {
  lat: number;
  lng: number;
  altitude: number;
  distance: number | null;
};

const MARKER_SIZE = 32.8;
const CLUSTER_DISTANCE = MARKER_SIZE * (2 / 3);
const HORIZON_DEGREES = 91.5;
const MAX_COUNTRY_LABEL_SIZE = 0.72;
const MIN_COUNTRY_LABEL_SIZE = 0.1;
const LABEL_SIZE_REFERENCE_DISTANCE = 330;
const INITIAL_ALTITUDE = 2.35;
const PANEL_SELECTION_ZOOM = GLOBE_ZOOM.max;
const CITY_VISIBILITY_DISTANCE = 170;
const CITY_MARKER_OVERLAP_DISTANCE = 26;
const CITY_LABEL_LIFT_PX = 16;

const topCountryCities = topCountryCitiesData as CityCenter[];
const universityCityCenters = cityCentersData as CityCenter[];
const EUROPE_CITY_LABEL_COUNTRIES = new Set([
  "Belgium",
  "Denmark",
  "France",
  "Germany",
  "Ireland",
  "Italy",
  "Netherlands",
  "Sweden",
  "Switzerland",
  "United Kingdom"
]);

function cityKey(city: Pick<CityCenter, "city" | "country">): string {
  return `${city.city.toLowerCase()}|${city.country.toLowerCase()}`;
}

function uniqueCities(cities: CityCenter[]): CityCenter[] {
  return [...new Map(cities.map((city) => [cityKey(city), city])).values()];
}

function parseRank(rank: string): number {
  const parsedRank = Number(rank.replace(/=/g, ""));
  return Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : Number.POSITIVE_INFINITY;
}

function getMarkerRank(university: University, rankingSource: RankingSource): string {
  return getRankForSource(university, rankingSource).replace(/=/g, "") || "NR";
}

function clusterKey(universities: University[]): string {
  return universities.map((university) => university.name).sort().join("|");
}

function distance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function angularDistanceDegrees(first: { lat: number; lng: number }, second: { lat: number; lng: number }): number {
  const latA = toRadians(first.lat);
  const latB = toRadians(second.lat);
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;

  return (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine))) * 180) / Math.PI;
}

function countryLabelSizeForDistance(distanceValue: number): number {
  const scaled = MAX_COUNTRY_LABEL_SIZE * (distanceValue / LABEL_SIZE_REFERENCE_DISTANCE);
  const clamped = Math.max(MIN_COUNTRY_LABEL_SIZE, Math.min(MAX_COUNTRY_LABEL_SIZE, scaled));
  return Math.round(clamped * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function inverseInterpolate(start: number, end: number, value: number): number {
  if (start === end) return 0;
  return (value - start) / (end - start);
}

function altitudeToZoom(altitude: number): number {
  const clampedAltitude = clamp(altitude, GLOBE_ZOOM.minAltitude, GLOBE_ZOOM.maxAltitude);
  const progress = inverseInterpolate(GLOBE_ZOOM.maxAltitude, GLOBE_ZOOM.minAltitude, clampedAltitude);

  return interpolate(GLOBE_ZOOM.min, GLOBE_ZOOM.max, progress);
}

function zoomToAltitude(zoom: number): number {
  const clampedZoom = clamp(zoom, GLOBE_ZOOM.min, GLOBE_ZOOM.max);
  const progress = inverseInterpolate(GLOBE_ZOOM.min, GLOBE_ZOOM.max, clampedZoom);

  return interpolate(GLOBE_ZOOM.maxAltitude, GLOBE_ZOOM.minAltitude, progress);
}

function clampViewAltitude(view: { lat: number; lng: number; altitude: number }) {
  return {
    ...view,
    altitude: clamp(view.altitude, GLOBE_ZOOM.minAltitude, GLOBE_ZOOM.maxAltitude)
  };
}

function buildMarkerClusters(
  universities: University[],
  points: Map<string, ScreenPoint>,
  projectCoordinate: (latitude: number, longitude: number) => ScreenPoint | null,
  rankingSource: RankingSource
): MarkerCluster[] {
  const visibleUniversities = universities.filter((university) => points.has(university.name));
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

  for (let index = 0; index < visibleUniversities.length; index += 1) {
    for (let other = index + 1; other < visibleUniversities.length; other += 1) {
      const first = visibleUniversities[index];
      const second = visibleUniversities[other];
      const pointA = points.get(first.name)!;
      const pointB = points.get(second.name)!;

      if (distance(pointA, pointB) <= CLUSTER_DISTANCE) {
        union(first.name, second.name);
      }
    }
  }

  const groups = new Map<string, University[]>();
  for (const university of visibleUniversities) {
    const root = find(university.name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(university);
  }

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort(
      (a, b) => parseRank(getRankForSource(a, rankingSource)) - parseRank(getRankForSource(b, rankingSource))
    );
    const centroid = sorted.reduce(
      (acc, university) => {
        acc.latitude += university.latitude;
        acc.longitude += university.longitude;
        return acc;
      },
      { latitude: 0, longitude: 0 }
    );
    centroid.latitude /= sorted.length;
    centroid.longitude /= sorted.length;

    const fallbackScreen = sorted.reduce(
      (acc, university) => {
        const point = points.get(university.name)!;
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    fallbackScreen.x /= sorted.length;
    fallbackScreen.y /= sorted.length;

    const screen = projectCoordinate(centroid.latitude, centroid.longitude) ?? fallbackScreen;

    return {
      key: clusterKey(sorted),
      universities: sorted,
      screen
    };
  });
}

function UniversityGlobeComponent({
  universities,
  language,
  rankingSource,
  activeUniversity,
  panelFocusRequest,
  listResetRequest,
  onSelect,
  onClusterSelect,
  onHover,
  onHoverEnd
}: UniversityGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const hasSetInitialView = useRef(false);
  const initialViewTimer = useRef<number | null>(null);
  const focusViewTimer = useRef<number | null>(null);
  const countryLabelSizeRef = useRef(MAX_COUNTRY_LABEL_SIZE);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [markerClusters, setMarkerClusters] = useState<MarkerCluster[]>([]);
  const [screenCountryLabels, setScreenCountryLabels] = useState<ScreenCountryLabel[]>([]);
  const [screenCityLabels, setScreenCityLabels] = useState<ScreenCityLabel[]>([]);
  const [countryLabelSize, setCountryLabelSize] = useState(MAX_COUNTRY_LABEL_SIZE);
  const [globeZoom, setGlobeZoom] = useState(altitudeToZoom(INITIAL_ALTITUDE));
  const [debugState, setDebugState] = useState<GlobeDebugState | null>(null);

  useEffect(() => {
    const updateSize = () => {
      const globeElement = document.querySelector<HTMLElement>(".globe-stage");
      if (!globeElement) return;
      const rect = globeElement.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!isGlobeReady) return;

    const controls = globeRef.current?.controls();
    if (!controls) return;

    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.minDistance = GLOBE_ZOOM.minCameraDistance;
    controls.maxDistance = GLOBE_ZOOM.maxCameraDistance;
  }, [isGlobeReady]);

  const resetToInitialView = (transitionMs = 850) => {
    const mit = universities.find((university) => university.name.includes("Massachusetts Institute of Technology"));
    if (!mit) return;

    globeRef.current?.pointOfView(
      {
        lat: mit.latitude,
        lng: mit.longitude,
        altitude: INITIAL_ALTITUDE
      },
      transitionMs
    );
  };

  useEffect(() => {
    if (!isGlobeReady || hasSetInitialView.current) return;

    hasSetInitialView.current = true;
    if (panelFocusRequest) return;
    initialViewTimer.current = window.setTimeout(() => {
      resetToInitialView(0);
      initialViewTimer.current = null;
    }, 80);
  }, [isGlobeReady, panelFocusRequest, universities]);

  useEffect(() => {
    if (!isGlobeReady || !panelFocusRequest) return;

    const { university } = panelFocusRequest;
    const focusSelectedUniversity = (transitionMs: number) => {
      setGlobeZoom(PANEL_SELECTION_ZOOM);
      globeRef.current?.pointOfView(
        {
          lat: university.latitude,
          lng: university.longitude,
          altitude: zoomToAltitude(PANEL_SELECTION_ZOOM)
        },
        transitionMs
      );
    };

    if (initialViewTimer.current !== null) {
      window.clearTimeout(initialViewTimer.current);
      initialViewTimer.current = null;
    }

    if (focusViewTimer.current !== null) {
      window.clearTimeout(focusViewTimer.current);
    }

    hasSetInitialView.current = true;
    focusSelectedUniversity(0);
    focusViewTimer.current = window.setTimeout(() => {
      focusSelectedUniversity(900);
      focusViewTimer.current = null;
    }, 120);
  }, [isGlobeReady, panelFocusRequest]);

  useEffect(
    () => () => {
      if (initialViewTimer.current !== null) {
        window.clearTimeout(initialViewTimer.current);
      }
      if (focusViewTimer.current !== null) {
        window.clearTimeout(focusViewTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isGlobeReady || listResetRequest === 0) return;

    const currentView = globeRef.current?.pointOfView();
    if (!currentView) return;

    globeRef.current?.pointOfView(
      {
        lat: currentView.lat,
        lng: currentView.lng,
        altitude: INITIAL_ALTITUDE
      },
      850
    );
  }, [isGlobeReady, listResetRequest]);

  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color("#111827");
    material.emissive = new THREE.Color("#06111f");
    material.emissiveIntensity = 0.38;
    material.shininess = 9;
    material.specular = new THREE.Color("#1f2937");
    return material;
  }, []);

  const countryLabels = useMemo(
    () => buildCountryLabels(universities, language),
    [language, universities]
  );
  const displayedCityCenters = useMemo(() => {
    const universityCityKeys = new Set(universities.map((university) => cityKey(university)));
    const filteredTopCountryCities = topCountryCities.filter(
      (cityCenter) => !EUROPE_CITY_LABEL_COUNTRIES.has(cityCenter.country) || universityCityKeys.has(cityKey(cityCenter))
    );
    return uniqueCities([
      ...filteredTopCountryCities,
      ...universityCityCenters.filter((cityCenter) => universityCityKeys.has(cityKey(cityCenter)))
    ]);
  }, [universities]);

  useEffect(() => {
    if (!isGlobeReady) return;

    let frame = 0;
    const updateOverlays = () => {
      const globe = globeRef.current;
      if (!globe) {
        frame = window.requestAnimationFrame(updateOverlays);
        return;
      }

      const points = new Map<string, ScreenPoint>();
      const nextCountryLabels: ScreenCountryLabel[] = [];
      const nextCityLabels: ScreenCityLabel[] = [];
      let currentView = globe.pointOfView();
      const clampedView = clampViewAltitude(currentView);
      if (clampedView.altitude !== currentView.altitude) {
        globe.pointOfView(clampedView, 0);
        currentView = clampedView;
      }
      const controls = globe.controls() as { getDistance?: () => number };
      const distanceValue = controls.getDistance?.();
      const showCityLabels = typeof distanceValue === "number" && distanceValue <= CITY_VISIBILITY_DISTANCE;
      setGlobeZoom(altitudeToZoom(currentView.altitude));

      if (SHOW_MAP_DEBUG_OVERLAY) {
        setDebugState({
          lat: currentView.lat,
          lng: currentView.lng,
          altitude: currentView.altitude,
          distance: typeof distanceValue === "number" ? distanceValue : null
        });
      }

      if (typeof distanceValue === "number") {
        const nextLabelSize = countryLabelSizeForDistance(distanceValue);
        if (nextLabelSize !== countryLabelSizeRef.current) {
          countryLabelSizeRef.current = nextLabelSize;
          setCountryLabelSize(nextLabelSize);
        }
      }

      for (const university of universities) {
        const isOnVisibleHemisphere =
          angularDistanceDegrees(
            { lat: currentView.lat, lng: currentView.lng },
            { lat: university.latitude, lng: university.longitude }
          ) <= HORIZON_DEGREES;

        if (!isOnVisibleHemisphere) continue;

        const screen = globe.getScreenCoords(university.latitude, university.longitude, 0.04) as ScreenPoint | null;
        if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
          points.set(university.name, screen);
        }
      }

      for (const countryLabel of countryLabels) {
        const isOnVisibleHemisphere =
          angularDistanceDegrees(
            { lat: currentView.lat, lng: currentView.lng },
            { lat: countryLabel.lat, lng: countryLabel.lng }
          ) <= HORIZON_DEGREES;

        if (!isOnVisibleHemisphere) continue;

        const screen = globe.getScreenCoords(countryLabel.lat, countryLabel.lng, 0.03) as ScreenPoint | null;
        if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
          nextCountryLabels.push({
            key: `${countryLabel.name}-${countryLabel.lat}-${countryLabel.lng}`,
            name: countryLabel.name,
            screen
          });
        }
      }

      if (showCityLabels) {
        for (const cityCenter of displayedCityCenters) {
          const isOnVisibleHemisphere =
            angularDistanceDegrees(
              { lat: currentView.lat, lng: currentView.lng },
              { lat: cityCenter.latitude, lng: cityCenter.longitude }
            ) <= HORIZON_DEGREES;

          if (!isOnVisibleHemisphere) continue;

          const screen = globe.getScreenCoords(cityCenter.latitude, cityCenter.longitude, 0.025) as ScreenPoint | null;
          if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
            const overlapsMarker = [...points.values()].some(
              (markerPoint) => distance(screen, markerPoint) <= CITY_MARKER_OVERLAP_DISTANCE
            );
            const overlapsCity = nextCityLabels.some(
              (existingCityLabel) => distance(screen, existingCityLabel.screen) <= CITY_MARKER_OVERLAP_DISTANCE
            );
            nextCityLabels.push({
              key: `${cityCenter.city}-${cityCenter.country}`,
              name: getLocalizedCity(cityCenter.city, language),
              isCapital: cityCenter.isCapital,
              screen: {
                x: screen.x,
                y: overlapsMarker || overlapsCity ? screen.y - CITY_LABEL_LIFT_PX : screen.y
              }
            });
          }
        }
      }

      setMarkerClusters(
        buildMarkerClusters(universities, points, (latitude, longitude) => {
          const screen = globe.getScreenCoords(latitude, longitude, 0.04) as ScreenPoint | null;
          return screen && Number.isFinite(screen.x) && Number.isFinite(screen.y) ? screen : null;
        }, rankingSource)
      );
      setScreenCountryLabels(nextCountryLabels);
      setScreenCityLabels(nextCityLabels);
      frame = window.requestAnimationFrame(updateOverlays);
    };

    frame = window.requestAnimationFrame(updateOverlays);
    return () => window.cancelAnimationFrame(frame);
  }, [countryLabels, displayedCityCenters, isGlobeReady, language, rankingSource, universities]);

  const selectUniversity = (university: University) => {
    onSelect(university);
    globeRef.current?.pointOfView(
      {
        lat: university.latitude,
        lng: university.longitude
      },
      850
    );
  };

  const setGlobeZoomLevel = (nextZoom: number, transitionMs = 0) => {
    const globe = globeRef.current;
    if (!globe) return;

    const currentView = globe.pointOfView();
    const clampedZoom = clamp(nextZoom, GLOBE_ZOOM.min, GLOBE_ZOOM.max);
    setGlobeZoom(clampedZoom);
    globe.pointOfView(
      {
        lat: currentView.lat,
        lng: currentView.lng,
        altitude: zoomToAltitude(clampedZoom)
      },
      transitionMs
    );
  };

  const setGlobeZoomFromSlider = (event: ChangeEvent<HTMLInputElement>) => {
    setGlobeZoomLevel(Number(event.target.value));
  };

  const adjustGlobeZoomFromSliderWheel = (event: ReactWheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const direction = event.deltaY > 0 ? -1 : 1;
    setGlobeZoomLevel(globeZoom + direction * GLOBE_ZOOM.sliderStep);
  };

  return (
    <section className="globe-stage" aria-label="Interactive 3D university globe">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere
        onGlobeReady={() => setIsGlobeReady(true)}
        atmosphereColor="#93c5fd"
        atmosphereAltitude={0.12}
        polygonsData={countryFeatures}
        polygonCapColor={() => "rgba(148, 163, 184, 0.09)"}
        polygonSideColor={() => "rgba(15, 23, 42, 0.16)"}
        polygonStrokeColor={() => "rgba(226, 232, 240, 0.18)"}
      />

      <button className="map-reset-button" type="button" onClick={() => resetToInitialView()} aria-label="Reset map view">
        <RotateCcw size={18} />
        <span>{getUiString(language, "resetZoom")}</span>
      </button>

      <label className="map-zoom-control" aria-label="Globe zoom level">
        <span>{GLOBE_ZOOM.max}x</span>
        <input
          type="range"
          min={GLOBE_ZOOM.min}
          max={GLOBE_ZOOM.max}
          step="0.01"
          value={globeZoom}
          onChange={setGlobeZoomFromSlider}
          onWheel={adjustGlobeZoomFromSliderWheel}
        />
        <span>{globeZoom.toFixed(1)}x</span>
      </label>

      <div className="marker-layer" aria-hidden={false}>
        {screenCountryLabels.map((countryLabel) => (
          <div
            key={countryLabel.key}
            className="country-label screen-country-label"
            style={{
              left: `${countryLabel.screen.x}px`,
              top: `${countryLabel.screen.y}px`,
              fontSize: `${Math.max(0.68, countryLabelSize * 0.92)}rem`
            }}
          >
            {countryLabel.name}
          </div>
        ))}
        {screenCityLabels.map((cityLabel) => (
          <div
            key={cityLabel.key}
            className={`city-label screen-city-label ${cityLabel.isCapital ? "is-capital" : ""}`}
            style={{
              left: `${cityLabel.screen.x}px`,
              top: `${cityLabel.screen.y}px`,
              zIndex: cityLabel.isCapital ? 3100 : 3000
            }}
          >
            <span className="city-dot" />
            <span className="city-name">{cityLabel.name}</span>
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
              className={`marker screen-marker ${containsActiveUniversity ? "is-active" : ""} ${isCluster ? "is-cluster" : ""}`}
              style={{
                left: `${cluster.screen.x}px`,
                top: `${cluster.screen.y}px`,
                zIndex: containsActiveUniversity
                  ? 2000
                  : Math.max(1, 1000 - parseRank(getRankForSource(topUniversity, rankingSource)))
              }}
              type="button"
              aria-label={
                isCluster
                  ? `${cluster.universities.length} university cluster, showing ${displayUniversity.name}`
                  : `${getMarkerRank(displayUniversity, rankingSource)}: ${displayUniversity.name}`
              }
              onMouseEnter={(event) => {
                const target = event.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
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
                selectUniversity(displayUniversity);
              }}
            >
              <img src={assetPath(displayUniversity.logoPath)} alt="" />
              {isCluster ? (
                <span className="cluster-count">+{hiddenCount}</span>
              ) : (
                <span className="marker-rank">{getMarkerRank(displayUniversity, rankingSource)}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="globe-caption">
        {getUiString(language, "globeCaption")}
      </div>
      {SHOW_MAP_DEBUG_OVERLAY && debugState ? (
        <div className="map-debug-overlay" aria-hidden="true">
          <span>global</span>
          <span>center {debugState.lat.toFixed(4)}, {debugState.lng.toFixed(4)}</span>
          <span>alt {debugState.altitude.toFixed(2)}</span>
          <span>distance {debugState.distance === null ? "n/a" : debugState.distance.toFixed(1)}</span>
        </div>
      ) : null}
    </section>
  );
}

export const UniversityGlobe = memo(UniversityGlobeComponent);
