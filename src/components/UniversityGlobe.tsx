import { memo, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import type { University, HoverState } from "../types";
import { assetPath } from "../utils/asset";
import { countryFeatures } from "../utils/globe";

type UniversityGlobeProps = {
  universities: University[];
  activeUniversity: University;
  onSelect: (university: University) => void;
  onHover: (hover: HoverState) => void;
};

const GLOBE_ALTITUDE = 2.35;

function UniversityGlobeComponent({ universities, activeUniversity, onSelect, onHover }: UniversityGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isGlobeReady, setIsGlobeReady] = useState(false);

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

  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial();
    material.color = new THREE.Color("#111827");
    material.emissive = new THREE.Color("#06111f");
    material.emissiveIntensity = 0.38;
    material.shininess = 9;
    material.specular = new THREE.Color("#1f2937");
    return material;
  }, []);

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
        htmlElementsData={universities}
        htmlLat={(d) => (d as University).latitude}
        htmlLng={(d) => (d as University).longitude}
        htmlAltitude={(d) => ((d as University).name === activeUniversity.name ? 0.055 : 0.035)}
        htmlElement={(d) => {
          const university = d as University;
          const marker = document.createElement("button");
          marker.className = `marker ${university.name === activeUniversity.name ? "is-active" : ""}`;
          marker.type = "button";
          marker.setAttribute("aria-label", `${university.rank}: ${university.name}`);
          marker.innerHTML = `<img src="${assetPath(university.logoPath)}" alt="" /><span>${university.rank}</span>`;
          marker.addEventListener("mouseenter", (event) => {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            onHover({
              university,
              x: rect.left + rect.width / 2,
              y: rect.top - 12
            });
          });
          marker.addEventListener("mousemove", (event) => {
            onHover({
              university,
              x: event.clientX,
              y: event.clientY - 18
            });
          });
          marker.addEventListener("mouseleave", () => onHover(null));
          marker.addEventListener("click", () => onSelect(university));
          return marker;
        }}
      />
      <div className="globe-caption">
        Drag to rotate and pan. Scroll or pinch to zoom. Hover markers for tuition and location details.
      </div>
    </section>
  );
}

export const UniversityGlobe = memo(UniversityGlobeComponent);
