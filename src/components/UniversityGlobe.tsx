import { memo, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { RotateCcw } from "lucide-react";
import * as THREE from "three";
import type { HoverState, University } from "../types";
import { assetPath } from "../utils/asset";
import { buildCountryLabels, countryFeatures } from "../utils/globe";

type UniversityGlobeProps = {
  universities: University[];
  activeUniversity: University;
  onSelect: (university: University) => void;
  onHover: (hover: HoverState) => void;
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

const MARKER_SIZE = 37.6;
const CLUSTER_DISTANCE = MARKER_SIZE * (2 / 3);
const HORIZON_DEGREES = 91.5;
const MAX_COUNTRY_LABEL_SIZE = 5;
const MIN_COUNTRY_LABEL_SIZE = 0.2;
const LABEL_SIZE_REFERENCE_DISTANCE = 330;
const INITIAL_ALTITUDE = 2.35;

function parseRank(rank: string): number {
  return Number(rank.replace(/=/g, ""));
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

function buildMarkerClusters(
  universities: University[],
  points: Map<string, ScreenPoint>,
  projectCoordinate: (latitude: number, longitude: number) => ScreenPoint | null
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
    const sorted = [...group].sort((a, b) => parseRank(a.rank2027) - parseRank(b.rank2027));
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

function UniversityGlobeComponent({ universities, activeUniversity, onSelect, onHover }: UniversityGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const hasSetInitialView = useRef(false);
  const countryLabelSizeRef = useRef(MAX_COUNTRY_LABEL_SIZE);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [markerClusters, setMarkerClusters] = useState<MarkerCluster[]>([]);
  const [countryLabelSize, setCountryLabelSize] = useState(MAX_COUNTRY_LABEL_SIZE);

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
    controls.minDistance = 70;
    controls.maxDistance = 760;
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
    window.setTimeout(() => resetToInitialView(0), 80);
  }, [isGlobeReady, universities]);

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
    () => buildCountryLabels(universities),
    [universities]
  );

  useEffect(() => {
    if (!isGlobeReady) return;

    let frame = 0;
    const updateMarkerClusters = () => {
      const globe = globeRef.current;
      if (!globe) {
        frame = window.requestAnimationFrame(updateMarkerClusters);
        return;
      }

      const points = new Map<string, ScreenPoint>();
      const currentView = globe.pointOfView();
      const controls = globe.controls() as { getDistance?: () => number };
      const distanceValue = controls.getDistance?.();

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

      setMarkerClusters(
        buildMarkerClusters(universities, points, (latitude, longitude) => {
          const screen = globe.getScreenCoords(latitude, longitude, 0.04) as ScreenPoint | null;
          return screen && Number.isFinite(screen.x) && Number.isFinite(screen.y) ? screen : null;
        })
      );
      frame = window.requestAnimationFrame(updateMarkerClusters);
    };

    frame = window.requestAnimationFrame(updateMarkerClusters);
    return () => window.cancelAnimationFrame(frame);
  }, [isGlobeReady, universities]);

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
        labelsData={countryLabels}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.name}
        labelColor={() => "rgba(226, 232, 240, 0.72)"}
        labelSize={() => countryLabelSize}
        labelAltitude={() => 0.03}
        labelDotRadius={() => 0}
        labelResolution={1}
        labelIncludeDot={false}
      />

      <button className="map-reset-button" type="button" onClick={() => resetToInitialView()} aria-label="Reset map view">
        <RotateCcw size={18} />
      </button>

      <div className="marker-layer" aria-hidden={false}>
        {markerClusters.map((cluster) => {
          const topUniversity = cluster.universities[0];
          const hiddenCount = cluster.universities.length - 1;
          const isCluster = hiddenCount > 0;

          return (
            <button
              key={cluster.key}
              className={`marker screen-marker ${topUniversity.name === activeUniversity.name ? "is-active" : ""} ${
                isCluster ? "is-cluster" : ""
              }`}
              style={{
                left: `${cluster.screen.x}px`,
                top: `${cluster.screen.y}px`,
                zIndex: 1000 - parseRank(topUniversity.rank2027)
              }}
              type="button"
              aria-label={
                isCluster
                  ? `${cluster.universities.length} university cluster, top ranked ${topUniversity.name}`
                  : `${topUniversity.rank2027}: ${topUniversity.name}`
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
                        university: topUniversity,
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
                        university: topUniversity,
                        x: event.clientX,
                        y: event.clientY - 18
                      }
                );
              }}
              onMouseLeave={() => onHover(null)}
              onClick={() => selectUniversity(topUniversity)}
            >
              <img src={assetPath(topUniversity.logoPath)} alt="" />
              {isCluster ? <span className="cluster-count">+{hiddenCount}</span> : <span>{topUniversity.rank2027}</span>}
            </button>
          );
        })}
      </div>
      <div className="globe-caption">
        Drag to rotate and pan. Scroll or pinch to zoom. Hover markers for tuition and location details.
      </div>
    </section>
  );
}

export const UniversityGlobe = memo(UniversityGlobeComponent);
