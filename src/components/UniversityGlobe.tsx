import { memo, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import type { HoverState, University } from "../types";
import { assetPath } from "../utils/asset";
import { countryFeatures } from "../utils/globe";

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

type Cluster = {
  key: string;
  universities: University[];
  center: ScreenPoint;
  isExpanded: boolean;
};

type MarkerLayout =
  | {
      type: "single";
      university: University;
      screen: ScreenPoint;
      zIndex: number;
    }
  | {
      type: "cluster";
      cluster: Cluster;
      screen: ScreenPoint;
      zIndex: number;
    }
  | {
      type: "expanded";
      university: University;
      screen: ScreenPoint;
      anchor: ScreenPoint;
      clusterKey: string;
      zIndex: number;
    };

const GLOBE_ALTITUDE = 2.35;
const CLUSTER_DISTANCE = 42;
const SPIDERFY_RADIUS = 36;

function parseRank(rank: string): number {
  return Number(rank.replace(/=/g, ""));
}

function distance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clusterUniversities(universities: University[], points: Map<string, ScreenPoint>) {
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

  const keyed = universities.filter((university) => points.has(university.name));
  for (let index = 0; index < keyed.length; index += 1) {
    for (let other = index + 1; other < keyed.length; other += 1) {
      const first = keyed[index];
      const second = keyed[other];
      const pointA = points.get(first.name)!;
      const pointB = points.get(second.name)!;
      if (distance(pointA, pointB) <= CLUSTER_DISTANCE) {
        union(first.name, second.name);
      }
    }
  }

  const groups = new Map<string, University[]>();
  for (const university of keyed) {
    const root = find(university.name);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(university);
  }

  return [...groups.values()].map((group) => {
    const center = group.reduce(
      (acc, university) => {
        const point = points.get(university.name)!;
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    center.x /= group.length;
    center.y /= group.length;
    return { universities: group, center };
  });
}

function UniversityGlobeComponent({ universities, activeUniversity, onSelect, onHover }: UniversityGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [layout, setLayout] = useState<MarkerLayout[]>([]);
  const [expandedClusterKey, setExpandedClusterKey] = useState<string | null>(null);

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
    controls.minDistance = 210;
    controls.maxDistance = 620;
  }, [isGlobeReady]);

  useEffect(() => {
    if (!isGlobeReady) return;

    const timer = window.setTimeout(() => {
      globeRef.current?.pointOfView(
        {
          lat: activeUniversity.latitude,
          lng: activeUniversity.longitude,
          altitude: GLOBE_ALTITUDE
        },
        900
      );
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeUniversity, isGlobeReady]);

  useEffect(() => {
    if (!isGlobeReady) return;

    let frame = 0;
    const updateLayout = () => {
      const globe = globeRef.current;
      if (!globe) {
        frame = window.requestAnimationFrame(updateLayout);
        return;
      }

      const points = new Map<string, ScreenPoint>();
      for (const university of universities) {
        const screen = globe.getScreenCoords(university.latitude, university.longitude, 0.04) as ScreenPoint | null;
        if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
          points.set(university.name, screen);
        }
      }

      const grouped = clusterUniversities(universities, points);
      const nextLayout: MarkerLayout[] = [];

      for (const group of grouped) {
        const sorted = [...group.universities].sort((a, b) => parseRank(a.rank2027) - parseRank(b.rank2027));
        const isExpanded =
          sorted.length > 1 &&
          (expandedClusterKey === group.universities.map((university) => university.name).sort().join("|") ||
            activeUniversity.name === sorted[0].name);
        const clusterKey = group.universities.map((university) => university.name).sort().join("|");

        if (sorted.length === 1) {
          nextLayout.push({
            type: "single",
            university: sorted[0],
            screen: group.center,
            zIndex: 1000 - parseRank(sorted[0].rank2027)
          });
          continue;
        }

        if (!isExpanded) {
          nextLayout.push({
            type: "cluster",
            cluster: {
              key: clusterKey,
              universities: sorted,
              center: group.center,
              isExpanded: false
            },
            screen: group.center,
            zIndex: 1000 - sorted.length
          });
          continue;
        }

        const radius = Math.max(SPIDERFY_RADIUS, 16 + sorted.length * 4);
        const angles = sorted.map((_, index) => (Math.PI * 2 * index) / sorted.length - Math.PI / 2);

        sorted.forEach((university, index) => {
          const angle = angles[index];
          const screen = {
            x: group.center.x + Math.cos(angle) * radius,
            y: group.center.y + Math.sin(angle) * radius
          };
          nextLayout.push({
            type: "expanded",
            university,
            screen,
            anchor: group.center,
            clusterKey,
            zIndex: 2000 - parseRank(university.rank2027)
          });
        });
      }

      setLayout(nextLayout);
      frame = window.requestAnimationFrame(updateLayout);
    };

    frame = window.requestAnimationFrame(updateLayout);
    return () => window.cancelAnimationFrame(frame);
  }, [activeUniversity.name, expandedClusterKey, isGlobeReady, universities]);

  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color("#111827");
    material.emissive = new THREE.Color("#06111f");
    material.emissiveIntensity = 0.38;
    material.shininess = 9;
    material.specular = new THREE.Color("#1f2937");
    return material;
  }, []);

  const closeCluster = () => {
    setExpandedClusterKey(null);
    onHover(null);
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

      <div className="marker-layer" aria-hidden={false}>
        {layout.map((item) => {
          if (item.type === "cluster") {
            const label = `${item.cluster.universities.length} universities`;
            return (
              <button
                key={item.cluster.key}
                className="marker cluster-marker"
                style={{ left: `${item.screen.x}px`, top: `${item.screen.y}px`, zIndex: item.zIndex }}
                type="button"
                aria-label={label}
                onMouseEnter={() => setExpandedClusterKey(item.cluster.key)}
                onMouseLeave={() => {
                  if (expandedClusterKey === item.cluster.key) closeCluster();
                }}
                onFocus={() => setExpandedClusterKey(item.cluster.key)}
                onBlur={() => {
                  if (expandedClusterKey === item.cluster.key) closeCluster();
                }}
                onClick={() => setExpandedClusterKey(item.cluster.key)}
                onPointerDown={(event) => event.preventDefault()}
              >
                <span>{item.cluster.universities.length}</span>
                <small>{item.cluster.universities.length === 1 ? "school" : "schools"}</small>
              </button>
            );
          }

          const university = item.university;
          const markerClass = item.type === "expanded" ? "is-expanded" : "";
          return (
            <div key={university.name} className="marker-wrap" style={{ zIndex: item.zIndex }}>
              {item.type === "expanded" && (
                <div
                  className="spider-line"
                  style={{
                    left: `${item.anchor.x}px`,
                    top: `${item.anchor.y}px`,
                    width: `${Math.hypot(item.screen.x - item.anchor.x, item.screen.y - item.anchor.y)}px`,
                    transform: `rotate(${Math.atan2(item.screen.y - item.anchor.y, item.screen.x - item.anchor.x)}rad)`
                  }}
                />
              )}
              <button
                className={`marker ${university.name === activeUniversity.name ? "is-active" : ""} ${markerClass}`}
                style={{ left: `${item.screen.x}px`, top: `${item.screen.y}px` }}
                type="button"
                aria-label={`${university.rank2027}: ${university.name}`}
                onMouseEnter={(event) => {
                  const target = event.currentTarget as HTMLElement;
                  const rect = target.getBoundingClientRect();
                  onHover({
                    university,
                    x: rect.left + rect.width / 2,
                    y: rect.top - 12
                  });
                  if (item.type === "expanded") {
                    setExpandedClusterKey(item.clusterKey);
                  }
                }}
                onMouseMove={(event) => {
                  onHover({
                    university,
                    x: event.clientX,
                    y: event.clientY - 18
                  });
                }}
                onMouseLeave={() => {
                  onHover(null);
                }}
                onFocus={() => onSelect(university)}
                onClick={() => onSelect(university)}
                onPointerDown={(event) => event.preventDefault()}
              >
                <img src={assetPath(university.logoPath)} alt="" />
                <span>{university.rank2027}</span>
              </button>
            </div>
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
